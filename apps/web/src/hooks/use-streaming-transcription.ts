"use client";

import { useCallback, useRef, useState } from "react";

import { getSTTToken } from "@/lib/api";

const STT_SPEECH_MODEL = "whisper-rt";

export interface UseStreamingTranscriptionReturn {
  isStreaming: boolean;
  transcript: string;
  partialText: string;
  startStreaming: (authToken: string) => Promise<void>;
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
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partialText, setPartialText] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
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
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "Terminate" }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const startStreaming = useCallback(
    async (authToken: string) => {
      if (isStreaming) return;

      setPartialText("");

      try {
        // Get microphone access first so we know the real browser sample rate.
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
        const sampleRate = Math.round(audioContext.sampleRate);

        // Get temporary token from backend
        const { token: sttToken } = await getSTTToken(authToken);

        const params = new URLSearchParams({
          sample_rate: String(sampleRate),
          speech_model: STT_SPEECH_MODEL,
          token: sttToken,
        });

        // Open WebSocket to AssemblyAI streaming API
        const ws = new WebSocket(
          `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`,
        );
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
          setIsStreaming(false);
        };

        ws.onclose = (event) => {
          if (event.code !== 1000) {
            console.error(
              `[STT] WebSocket closed unexpectedly: code=${event.code}, reason=${event.reason}`,
            );
          }
          cleanup();
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
        setIsStreaming(false);
      }
    },
    [isStreaming, cleanup],
  );

  const stopStreaming = useCallback(() => {
    setPartialText("");
    cleanup();
    setIsStreaming(false);
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setPartialText("");
  }, []);

  return {
    isStreaming,
    transcript,
    partialText,
    startStreaming,
    stopStreaming,
    resetTranscript,
  };
}
