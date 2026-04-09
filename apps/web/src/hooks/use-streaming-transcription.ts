"use client";

import { useCallback, useRef, useState } from "react";

import { getSTTToken } from "@/lib/api";

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

      // Get temporary token from backend
      const { token: sttToken } = await getSTTToken(authToken);

      // Open WebSocket to AssemblyAI streaming API
      const ws = new WebSocket(
        `wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&token=${sttToken}`,
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
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        cleanup();
        setIsStreaming(false);
      };

      ws.onclose = () => {
        cleanup();
        setIsStreaming(false);
      };

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        const prevOnError = ws.onerror;
        ws.onerror = (e) => {
          if (prevOnError) (prevOnError as (e: Event) => void)(e);
          reject(new Error("WebSocket connection failed"));
        };
      });

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up AudioContext at 16kHz for PCM16 conversion
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

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
