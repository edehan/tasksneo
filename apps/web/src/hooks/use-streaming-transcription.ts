"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getSTTToken } from "@/lib/api";

export interface UseStreamingTranscriptionReturn {
  isConnecting: boolean;
  isStreaming: boolean;
  transcript: string;
  partialText: string;
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  resetTranscript: () => void;
}

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function useStreamingTranscription(): UseStreamingTranscriptionReturn {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialText, setPartialText] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const startAttemptRef = useRef(0);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "Terminate" }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startStreaming = useCallback(async () => {
    if (isStreaming || isConnecting) return;

    const attemptId = startAttemptRef.current + 1;
    startAttemptRef.current = attemptId;
    setIsConnecting(true);
    setPartialText("");

    try {
      // Get microphone access first so we know the real browser sample rate.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (attemptId !== startAttemptRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext();
      if (attemptId !== startAttemptRef.current) {
        void audioContext.close();
        return;
      }
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
        if (attemptId !== startAttemptRef.current) return;
      }
      const sampleRate = Math.round(audioContext.sampleRate);

      // Get temporary token and speech model from backend
      const { token: sttToken, speechModel } = await getSTTToken();
      if (attemptId !== startAttemptRef.current) return;

      const params = new URLSearchParams({
        sample_rate: String(sampleRate),
        speech_model: speechModel,
        token: sttToken,
      });

      // Open WebSocket to AssemblyAI streaming API
      const ws = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`,
      );
      if (attemptId !== startAttemptRef.current) {
        ws.close();
        return;
      }
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            transcript?: string;
            end_of_turn?: boolean;
            error?: string;
          };

          if (msg.type === "Turn") {
            const text = msg.transcript ?? "";
            if (msg.end_of_turn) {
              if (text) {
                setTranscript((prev) => (prev ? `${prev} ${text}` : text));
              }
              setPartialText("");
            } else {
              setPartialText(text);
            }
            return;
          }

          if (msg.type === "Error" && msg.error) {
            console.error("[STT] AssemblyAI stream error:", msg.error);
          }
        } catch (err) {
          console.error("[STT] Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[STT] WebSocket error event:", event);
        cleanup();
        setIsConnecting(false);
        setIsStreaming(false);
      };

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          console.error(
            `[STT] WebSocket closed unexpectedly: code=${event.code}, reason=${event.reason}`,
          );
        }
        cleanup();
        setIsConnecting(false);
        setIsStreaming(false);
      };

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          ws.removeEventListener("error", handleOpenError);
          resolve();
        };
        const handleOpenError = () => {
          ws.removeEventListener("open", handleOpen);
          reject(new Error("WebSocket connection failed"));
        };

        ws.addEventListener("open", handleOpen, { once: true });
        ws.addEventListener("error", handleOpenError, { once: true });
      });
      if (attemptId !== startAttemptRef.current) return;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = floatTo16BitPCM(inputData);
        ws.send(pcm16);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsStreaming(true);
    } catch (err) {
      console.error("[STT] Failed to start streaming:", err);
      cleanup();
      setIsConnecting(false);
      setIsStreaming(false);
    } finally {
      if (attemptId === startAttemptRef.current) {
        setIsConnecting(false);
      }
    }
  }, [isStreaming, isConnecting, cleanup]);

  const stopStreaming = useCallback(() => {
    startAttemptRef.current += 1;
    setIsConnecting(false);
    setPartialText("");
    cleanup();
    setIsStreaming(false);
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setPartialText("");
  }, []);

  // Ensure mic/WS resources are always released on component unmount.
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnecting,
    isStreaming,
    transcript,
    partialText,
    startStreaming,
    stopStreaming,
    resetTranscript,
  };
}
