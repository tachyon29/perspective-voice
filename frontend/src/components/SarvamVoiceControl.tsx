import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { backendFetch } from "../lib/api";
import type { AIChatMessage } from "../lib/aiChat";

export type SarvamVoiceMode = "tutor" | "teammate" | "consulting";

interface SarvamVoiceControlProps {
  mode: SarvamVoiceMode;
  history: AIChatMessage[];
  context: Record<string, string>;
  onExchange: (transcript: string, reply: string) => void;
  persona?: string;
  role?: string;
  label?: string;
}

export default function SarvamVoiceControl({
  mode, history, context, onExchange, persona, role, label = "Ask by voice",
}: SarvamVoiceControlProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingClockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recordingClockRef.current) clearInterval(recordingClockRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const processRecording = async (blob: Blob) => {
    setBusy(true);
    setStatus("Sarvam is listening…");
    try {
      const form = new FormData();
      form.append("audio", blob, `voice.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
      form.append("mode", mode);
      form.append("history", JSON.stringify(history.slice(-8)));
      form.append("context", JSON.stringify(context));
      form.append("persona", persona ?? "");
      form.append("role", role ?? "");
      const response = await backendFetch("/ai/voice", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Sarvam could not process your voice message.");

      onExchange(result.transcript, result.reply);
      if (!result.audio) {
        setStatus(`Heard ${result.language_code}: ${result.transcript}. Text reply received; spoken audio could not be generated.`);
        return;
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const binary = atob(result.audio as string);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const nextUrl = URL.createObjectURL(new Blob([bytes], { type: result.audio_mime_type || "audio/wav" }));
      audioUrlRef.current = nextUrl;
      setAudioUrl(nextUrl);
      setStatus(`Heard ${result.language_code}: ${result.transcript}. Reply spoken in ${result.spoken_language_code ?? result.language_code}.`);
      const playback = new Audio(nextUrl);
      void playback.play().catch(() => setStatus("Reply ready. Use the audio controls to play it."));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send the voice message.");
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (recordingClockRef.current) clearInterval(recordingClockRef.current);
    recordingClockRef.current = null;
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      setRecording(false);
      setStatus("Sending your question…");
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("Voice recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        void processRecording(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      setStatus("Recording… speak naturally in your language (25 seconds max).");
      recordingClockRef.current = setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
      timerRef.current = setTimeout(() => {
        if (recorder.state === "recording") {
          if (recordingClockRef.current) clearInterval(recordingClockRef.current);
          recordingClockRef.current = null;
          recorder.stop();
          setRecording(false);
          setStatus("Recording limit reached. Sending your question…");
        }
      }, 25_000);
    } catch {
      setStatus("Microphone access was blocked. Allow microphone access and try again.");
    }
  };

  return (
    <div className="sarvam-voice-control">
      <button
        type="button"
        className={`sarvam-voice-button${recording ? " is-recording" : ""}`}
        onClick={recording ? stopRecording : () => void startRecording()}
        disabled={busy}
        aria-label={recording ? "Stop recording" : label}
      >
        {recording ? <Square size={14} /> : <Mic size={15} />}
        <span>{recording ? "Stop" : label}</span>
      </button>
      {recording && (
        <span className="voice-recording-indicator" role="status" aria-live="polite">
          <i aria-hidden="true" />
          <strong>Recording</strong>
          <span>{`0:${String(recordingSeconds).padStart(2, "0")}`}</span>
          <span className="voice-recording-wave" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        </span>
      )}
      {busy && <span className="sarvam-voice-status" role="status">Sarvam is listening…</span>}
      {!busy && !recording && status && <span className="sarvam-voice-status" role="status">{status}</span>}
      {audioUrl && <audio className="sarvam-voice-audio" controls src={audioUrl} aria-label="Spoken Sarvam reply" />}
    </div>
  );
}
