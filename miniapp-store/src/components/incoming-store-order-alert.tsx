import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Text, useSnackbar } from "zmp-ui";
import {
  openPermissionSetting,
  requestSendNotification,
  vibrate as zmpVibrate,
} from "zmp-sdk";
import { initSocket } from "services/socket";
import { DisplayPrice } from "components/display/price";
import incomingOrderVoiceVi from "static/incoming-order-vi.mp3";
import voiceDigit0 from "static/voice/0.mp3";
import voiceDigit1 from "static/voice/1.mp3";
import voiceDigit2 from "static/voice/2.mp3";
import voiceDigit3 from "static/voice/3.mp3";
import voiceDigit4 from "static/voice/4.mp3";
import voiceDigit5 from "static/voice/5.mp3";
import voiceDigit6 from "static/voice/6.mp3";
import voiceDigit7 from "static/voice/7.mp3";
import voiceDigit8 from "static/voice/8.mp3";
import voiceDigit9 from "static/voice/9.mp3";
import voicePrefixVi from "static/voice/prefix.mp3";
import voiceSuffixVi from "static/voice/suffix.mp3";
import { requestNotificationPermission, showNativeNotification } from "utils/notification";
import { formatStoreOrderCode, getPickupOrderCodeLast4Digits } from "utils/order-code";
import { cancelOrder, confirmStoreOrder, fetchStoreOrders } from "services/api";

type StoreOrderAction = "accept" | "reject";
type StoreIncomingOrder = {
  id: string;
  storeId?: string;
  store?: {
    id?: string;
  } | null;
  status: string;
  total: number;
  createdAt?: string;
  items?: any[];
};

type DeviceSignalResult = {
  ok: boolean;
  report: string;
};

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }
  return "unknown";
};

const createAlertToneDataUri = () => {
  const sampleRate = 22050;
  const durationSeconds = 0.84;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);

  const pulseStart = [0, 0.28, 0.56];
  const pulseLength = 0.2;
  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / sampleRate;
    let envelope = 0;
    for (const start of pulseStart) {
      const end = start + pulseLength;
      if (time >= start && time <= end) {
        const localTime = time - start;
        const attack = Math.min(1, localTime / 0.02);
        const release = Math.max(0, (end - time) / 0.1);
        envelope = Math.max(envelope, Math.min(attack, release));
      }
    }

    const tone =
      Math.sin(2 * Math.PI * 880 * time) * 0.78
      + Math.sin(2 * Math.PI * 1320 * time) * 0.24;
    const sample = Math.max(-1, Math.min(1, tone * envelope));
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
};

const ALERT_TONE_DATA_URI = createAlertToneDataUri();
const INCOMING_ORDER_VOICE_MESSAGE = "Bạn có đơn hàng cần chuẩn bị";
const INCOMING_ORDER_VOICE_ASSET = incomingOrderVoiceVi;
const INCOMING_ORDER_TTS_URLS = [
  "https://translate.google.com/translate_tts",
  "https://translate.google.com.vn/translate_tts",
];
const LOCAL_VOICE_DIGIT_ASSETS: Record<string, string> = {
  "0": voiceDigit0,
  "1": voiceDigit1,
  "2": voiceDigit2,
  "3": voiceDigit3,
  "4": voiceDigit4,
  "5": voiceDigit5,
  "6": voiceDigit6,
  "7": voiceDigit7,
  "8": voiceDigit8,
  "9": voiceDigit9,
};
const LOCAL_VOICE_PREFIX_ASSET = voicePrefixVi;
const LOCAL_VOICE_SUFFIX_ASSET = voiceSuffixVi;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ALERT_REPEAT_DURATION_MS = 60_000;
const ALERT_REPEAT_INTERVAL_MS = 5_000;
const VOICE_SEGMENT_GAP_MS = 20;
const VOICE_SEGMENT_RATE = 1.2;

const buildIncomingOrderVoiceMessage = (orderCode: string) => {
  const last4Digits = getPickupOrderCodeLast4Digits(orderCode);
  const readableDigits = last4Digits.split("").join(" ");
  return `Bạn có đơn hàng ${readableDigits} cần chuẩn bị`;
};

const buildIncomingOrderVoiceSequence = (orderCode: string) => {
  const last4Digits = getPickupOrderCodeLast4Digits(orderCode);
  const digitAssets = last4Digits
    .split("")
    .map((digit) => LOCAL_VOICE_DIGIT_ASSETS[digit])
    .filter((asset): asset is string => !!asset);
  return [
    LOCAL_VOICE_PREFIX_ASSET,
    ...digitAssets,
    LOCAL_VOICE_SUFFIX_ASSET,
  ].filter((asset): asset is string => !!asset);
};

export const IncomingStoreOrderAlert: FC = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const mountedAtRef = useRef(Date.now());
  const didBootstrapPollingRef = useRef(false);
  const knownActionableOrderIdsRef = useRef<Set<string>>(new Set());

  const [incomingOrders, setIncomingOrders] = useState<StoreIncomingOrder[]>([]);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState<StoreOrderAction | null>(null);
  const [openingPermission, setOpeningPermission] = useState(false);
  const [lastDiagnostics, setLastDiagnostics] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const voiceBufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const incomingOrdersRef = useRef<StoreIncomingOrder[]>([]);
  const repeatAlertStopMapRef = useRef<Map<string, () => void>>(new Map());
  const snackbarRef = useRef(snackbar);
  const hasPendingOrder = useMemo(
    () => incomingOrders.some((order) => order.status === "PENDING"),
    [incomingOrders],
  );

  useEffect(() => {
    snackbarRef.current = snackbar;
  }, [snackbar]);

  useEffect(() => {
    incomingOrdersRef.current = incomingOrders;
  }, [incomingOrders]);

  const triggerNativeBridgeVibrate = useCallback((milliseconds: number, logs: string[]) => {
    const bridge = (window as any)?.ZaloJavaScriptInterface;
    if (!bridge) {
      logs.push("bridge:none");
      return false;
    }

    let sent = false;
    try {
      if (typeof bridge.vibrate === "function") {
        bridge.vibrate(milliseconds);
        logs.push("bridge.vibrate:ok");
        sent = true;
      } else {
        logs.push("bridge.vibrate:none");
      }
    } catch (error) {
      logs.push(`bridge.vibrate:fail(${getErrorMessage(error)})`);
    }

    try {
      if (typeof bridge.jsCall === "function") {
        const payload = JSON.stringify({ type: 0, vibrate_time: milliseconds });
        // Signature: jsCall(jsAccessToken, action, accessToken, params, callback)
        bridge.jsCall("", "INTERACTIVE_VIBRATION", "", payload, "");
        logs.push("bridge.jsCall:ok");
        sent = true;
      } else {
        logs.push("bridge.jsCall:none");
      }
    } catch (error) {
      logs.push(`bridge.jsCall:fail(${getErrorMessage(error)})`);
    }

    return sent;
  }, []);

  const triggerHaptic = useCallback(async (): Promise<DeviceSignalResult> => {
    const logs: string[] = [];
    let nativeTriggered = false;
    let browserAccepted = false;

    const emitPulse = async (milliseconds: number, label: string) => {
      try {
        if (navigator.vibrate) {
          const browserTriggered = navigator.vibrate(milliseconds);
          logs.push(`${label}:navigator:${browserTriggered ? "ok" : "ignored"}`);
          if (browserTriggered) {
            browserAccepted = true;
          }
        }
      } catch (error) {
        logs.push(`${label}:navigator:fail(${getErrorMessage(error)})`);
      }

      try {
        await zmpVibrate({ type: "oneShot", milliseconds });
        logs.push(`${label}:ok`);
        nativeTriggered = true;
      } catch (error) {
        logs.push(`${label}:fail(${getErrorMessage(error)})`);
      }

      if (triggerNativeBridgeVibrate(milliseconds, logs)) {
        nativeTriggered = true;
      }
    };

    await emitPulse(280, "pulse#1");
    await delay(180);
    await emitPulse(280, "pulse#2");
    await delay(220);
    await emitPulse(420, "pulse#3");

    try {
      const legacyVibFn = (window as any)?.navigator?.notification?.vibrate;
      if (typeof legacyVibFn === "function") {
        legacyVibFn([280, 180, 280, 200, 420]);
        logs.push("navigator.notification.vibrate:ok");
        nativeTriggered = true;
      } else {
        logs.push("navigator.notification.vibrate:none");
      }
    } catch (error) {
      logs.push(`navigator.notification.vibrate:fail(${getErrorMessage(error)})`);
    }

    if (!nativeTriggered) {
      try {
        if (navigator.vibrate) {
          const fallbackOk = navigator.vibrate([280, 180, 280, 200, 420]);
          logs.push(`navigator.vibrate:fallback:${fallbackOk ? "ok" : "ignored"}`);
          if (fallbackOk) {
            browserAccepted = true;
          }
        }
      } catch (error) {
        logs.push(`navigator.vibrate:fallback:fail(${getErrorMessage(error)})`);
      }
    }

    logs.push(`summary:native=${nativeTriggered ? 1 : 0},browser=${browserAccepted ? 1 : 0}`);

    return {
      ok: nativeTriggered || browserAccepted,
      report: logs.join(" | "),
    };
  }, [triggerNativeBridgeVibrate]);

  const warmUpAudio = useCallback(async () => {
    const logs: string[] = [];
    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;

    if (AudioCtx) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }
        logs.push(`ctx:${audioContextRef.current?.state || "unknown"}`);
      } catch (error) {
        logs.push(`ctx:fail(${getErrorMessage(error)})`);
      }
    } else {
      logs.push("ctx:none");
    }

    const warmAudioElement = async (audioElement: HTMLAudioElement | null, label: string) => {
      if (!audioElement) {
        logs.push(`${label}:none`);
        return;
      }
      try {
        const originalMuted = audioElement.muted;
        audioElement.muted = true;
        audioElement.currentTime = 0;
        await audioElement.play();
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.muted = originalMuted;
        logs.push(`${label}:warm-ok`);
      } catch (error) {
        logs.push(`${label}:warm-fail(${getErrorMessage(error)})`);
      }
    };

    await warmAudioElement(voiceAudioRef.current, "voice-audio");
    await warmAudioElement(audioRef.current, "beep-audio");

    return logs.join(" | ");
  }, []);

  const playLocalVoiceClip = useCallback(async (): Promise<DeviceSignalResult> => {
    const audioElement = voiceAudioRef.current;
    if (!audioElement) {
      return { ok: false, report: "voice:missing" };
    }

    try {
      audioElement.pause();
      audioElement.muted = false;
      audioElement.volume = 1;
      audioElement.currentTime = 0;

      const started = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          audioElement.removeEventListener("playing", onPlaying);
          audioElement.removeEventListener("error", onError);
          audioElement.removeEventListener("stalled", onStalled);
          audioElement.removeEventListener("abort", onAbort);
          resolve(ok);
        };
        const onPlaying = () => finish(true);
        const onError = () => finish(false);
        const onStalled = () => finish(false);
        const onAbort = () => finish(false);
        const timeoutId = setTimeout(() => finish(false), 4200);

        audioElement.addEventListener("playing", onPlaying);
        audioElement.addEventListener("error", onError);
        audioElement.addEventListener("stalled", onStalled);
        audioElement.addEventListener("abort", onAbort);

        audioElement.play().catch(() => finish(false));
      });

      if (!started) {
        return { ok: false, report: "voice:blocked" };
      }
      return { ok: true, report: "voice:ok(local-vi)" };
    } catch (error) {
      return { ok: false, report: `voice:fail(${getErrorMessage(error)})` };
    }
  }, []);

  const playLocalVoiceSequenceFromAssets = useCallback(async (orderCode: string): Promise<DeviceSignalResult> => {
    const logs: string[] = [];
    const sequence = buildIncomingOrderVoiceSequence(orderCode);
    if (sequence.length === 0) {
      return { ok: false, report: "voice-seq:empty" };
    }

    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        return { ok: false, report: "voice-seq:web-audio-none" };
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (!ctx) {
        return { ok: false, report: "voice-seq:ctx-null" };
      }
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      for (let i = 0; i < sequence.length; i += 1) {
        const src = sequence[i];
        let buffer = voiceBufferCacheRef.current.get(src);
        if (!buffer) {
          const response = await fetch(src, { cache: "force-cache" });
          if (!response.ok) {
            logs.push(`voice-seq#${i + 1}:http-${response.status}`);
            return { ok: false, report: logs.join(" | ") };
          }
          const bytes = await response.arrayBuffer();
          buffer = await ctx.decodeAudioData(bytes.slice(0));
          voiceBufferCacheRef.current.set(src, buffer);
          logs.push(`voice-seq#${i + 1}:decoded`);
        } else {
          logs.push(`voice-seq#${i + 1}:cached`);
        }

        const playbackOk = await new Promise<boolean>((resolve) => {
          let settled = false;
          const source = ctx.createBufferSource();
          const gainNode = ctx.createGain();
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            source.onended = null;
            resolve(ok);
          };
          const timeoutMs = Math.max(1600, Math.ceil((buffer!.duration + 1) * 1000));
          const timeoutId = setTimeout(() => finish(false), timeoutMs);

          source.buffer = buffer!;
          source.playbackRate.setValueAtTime(VOICE_SEGMENT_RATE, ctx.currentTime);
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          gainNode.gain.setValueAtTime(1, ctx.currentTime);
          source.onended = () => finish(true);
          source.start(0);
        });

        if (!playbackOk) {
          logs.push(`voice-seq#${i + 1}:play-fail`);
          return { ok: false, report: logs.join(" | ") };
        }
        logs.push(`voice-seq#${i + 1}:ok`);
        await delay(VOICE_SEGMENT_GAP_MS);
      }

      return { ok: true, report: logs.join(" | ") };
    } catch (error) {
      return {
        ok: false,
        report: `voice-seq:fail(${getErrorMessage(error)})${logs.length > 0 ? ` | ${logs.join(" | ")}` : ""}`,
      };
    }
  }, []);

  const speakIncomingOrder = useCallback(async (message: string): Promise<DeviceSignalResult> => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return { ok: false, report: "speech:none" };

      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = "vi-VN";
      utterance.rate = 1.2;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = typeof synth.getVoices === "function" ? synth.getVoices() : [];
      const viVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith("vi"));
      if (viVoice) {
        utterance.voice = viVoice;
      }

      const result = await new Promise<DeviceSignalResult>((resolve) => {
        let settled = false;
        const finish = (ok: boolean, report: string) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve({ ok, report });
        };

        const timeoutId = setTimeout(() => finish(false, "speech:timeout"), 1800);
        utterance.onstart = () => finish(true, `speech:start${viVoice ? ":vi" : ":default"}`);
        utterance.onerror = (event: any) => {
          finish(false, `speech:error(${event?.error || "unknown"})`);
        };

        synth.cancel();
        synth.speak(utterance);
      });

      return result;
    } catch (error) {
      return {
        ok: false,
        report: `speech:fail(${getErrorMessage(error)})`,
      };
    }
  }, []);

  const playRemoteVoiceClip = useCallback(async (message: string): Promise<DeviceSignalResult> => {
    const logs: string[] = [];

    for (let i = 0; i < INCOMING_ORDER_TTS_URLS.length; i += 1) {
      try {
        const base = INCOMING_ORDER_TTS_URLS[i];
        const query = new URLSearchParams({
          ie: "UTF-8",
          client: "tw-ob",
          tl: "vi",
          q: message,
          v: String(Date.now()),
        });
        const audio = new Audio(`${base}?${query.toString()}`);
        audio.preload = "auto";
        audio.volume = 1;
        audio.setAttribute("playsinline", "true");
        audio.setAttribute("webkit-playsinline", "true");

        const started = await new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            audio.removeEventListener("playing", onPlaying);
            audio.removeEventListener("error", onError);
            audio.removeEventListener("stalled", onStalled);
            audio.removeEventListener("abort", onAbort);
            resolve(ok);
          };
          const onPlaying = () => finish(true);
          const onError = () => finish(false);
          const onStalled = () => finish(false);
          const onAbort = () => finish(false);
          const timeoutId = setTimeout(() => finish(false), 3200);

          audio.addEventListener("playing", onPlaying);
          audio.addEventListener("error", onError);
          audio.addEventListener("stalled", onStalled);
          audio.addEventListener("abort", onAbort);
          audio.play().catch(() => finish(false));
        });

        logs.push(`remote-tts#${i + 1}:${started ? "ok" : "fail"}`);
        if (started) {
          return { ok: true, report: logs.join(" | ") };
        }
      } catch (error) {
        logs.push(`remote-tts#${i + 1}:fail(${getErrorMessage(error)})`);
      }
    }

    return { ok: false, report: logs.join(" | ") || "remote-tts:none" };
  }, []);

  const playWebAudioBeep = useCallback(async (): Promise<DeviceSignalResult> => {
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        return { ok: false, report: "web-audio:none" };
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (!ctx) {
        return { ok: false, report: "web-audio:ctx-null" };
      }
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const scheduleBeep = (startAt: number, frequency: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, startAt);
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(0.9, startAt + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);
        oscillator.start(startAt);
        oscillator.stop(startAt + 0.22);
      };

      scheduleBeep(ctx.currentTime, 880);
      scheduleBeep(ctx.currentTime + 0.26, 980);
      scheduleBeep(ctx.currentTime + 0.52, 880);
      return { ok: true, report: `web-audio:${ctx.state}` };
    } catch (error) {
      return {
        ok: false,
        report: `web-audio:fail(${getErrorMessage(error)})`,
      };
    }
  }, []);

  const playIncomingAlertTone = useCallback(async (options?: {
    voiceMessage?: string;
    orderCode?: string;
  }): Promise<DeviceSignalResult> => {
    const logs: string[] = [];
    logs.push(await warmUpAudio());

    const messageToSpeak =
      (options?.voiceMessage || INCOMING_ORDER_VOICE_MESSAGE).trim()
      || INCOMING_ORDER_VOICE_MESSAGE;
    const orderCodeForVoice = (options?.orderCode || "").trim();

    if (orderCodeForVoice) {
      const localSequenceResult = await playLocalVoiceSequenceFromAssets(orderCodeForVoice);
      logs.push(localSequenceResult.report);
      if (localSequenceResult.ok) {
        return { ok: true, report: logs.join(" | ") };
      }
    }

    const speechResult = await speakIncomingOrder(messageToSpeak);
    logs.push(speechResult.report);
    if (speechResult.ok) {
      return { ok: true, report: logs.join(" | ") };
    }

    const remoteVoiceResult = await playRemoteVoiceClip(messageToSpeak);
    logs.push(remoteVoiceResult.report);
    if (remoteVoiceResult.ok) {
      return { ok: true, report: logs.join(" | ") };
    }

    const canUseStaticVoice = messageToSpeak === INCOMING_ORDER_VOICE_MESSAGE;
    let localVoiceResult: DeviceSignalResult = { ok: false, report: "voice:skip-dynamic" };
    if (canUseStaticVoice) {
      localVoiceResult = await playLocalVoiceClip();
      logs.push(localVoiceResult.report);
      if (localVoiceResult.ok) {
        return { ok: true, report: logs.join(" | ") };
      }
    } else {
      logs.push(localVoiceResult.report);
    }

    if (audioRef.current) {
      try {
        audioRef.current.volume = 1;
        audioRef.current.muted = false;
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        logs.push("html-audio:ok");
        return { ok: true, report: logs.join(" | ") };
      } catch (error) {
        logs.push(`html-audio:fail(${getErrorMessage(error)})`);
      }
    } else {
      logs.push("html-audio:none");
    }

    const webAudioResult = await playWebAudioBeep();
    logs.push(webAudioResult.report);
    if (webAudioResult.ok) {
      return { ok: true, report: logs.join(" | ") };
    }
    return {
      ok: speechResult.ok || remoteVoiceResult.ok || localVoiceResult.ok,
      report: logs.join(" | "),
    };
  }, [playLocalVoiceClip, playLocalVoiceSequenceFromAssets, playRemoteVoiceClip, playWebAudioBeep, speakIncomingOrder, warmUpAudio]);

  const stopRepeatingAlertLoop = useCallback((orderId: string) => {
    const stop = repeatAlertStopMapRef.current.get(orderId);
    if (stop) {
      stop();
      repeatAlertStopMapRef.current.delete(orderId);
    }
  }, []);

  const startRepeatingAlertLoop = useCallback((order: StoreIncomingOrder) => {
    stopRepeatingAlertLoop(order.id);

    const initialStatus = order.status;
    const orderCode = formatStoreOrderCode(order);
    const voiceMessage = buildIncomingOrderVoiceMessage(orderCode);
    const startedAt = Date.now();
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const shouldStopLoop = () => {
      if (stopped) return true;
      if (Date.now() - startedAt >= ALERT_REPEAT_DURATION_MS) return true;

      const currentOrder = incomingOrdersRef.current.find((item) => item.id === order.id);
      if (!currentOrder) return true;

      if (initialStatus === "PENDING" && currentOrder.status !== "PENDING") {
        return true;
      }

      return false;
    };

    const runLoop = async () => {
      if (stopped || running) return;
      if (shouldStopLoop()) {
        stop();
        repeatAlertStopMapRef.current.delete(order.id);
        return;
      }

      running = true;
      try {
        const [audioResult, hapticResult] = await Promise.all([
          playIncomingAlertTone({ voiceMessage, orderCode }),
          triggerHaptic(),
        ]);
        setLastDiagnostics(`Audio: ${audioResult.report} || Haptic: ${hapticResult.report}`);
      } catch (error) {
        const next = `repeat:fail(${getErrorMessage(error)})`;
        setLastDiagnostics((prev) => (prev === next ? prev : next));
      } finally {
        running = false;
        if (!shouldStopLoop()) {
          timer = setTimeout(() => {
            void runLoop();
          }, ALERT_REPEAT_INTERVAL_MS);
        } else {
          stop();
          repeatAlertStopMapRef.current.delete(order.id);
        }
      }
    };

    repeatAlertStopMapRef.current.set(order.id, stop);
    timer = setTimeout(() => {
      void runLoop();
    }, ALERT_REPEAT_INTERVAL_MS);
  }, [playIncomingAlertTone, stopRepeatingAlertLoop, triggerHaptic]);

  const upsertIncomingOrder = useCallback((order: StoreIncomingOrder) => {
    setIncomingOrders((previousOrders) => {
      const filtered = previousOrders.filter((item) => item.id !== order.id);
      return [order, ...filtered].slice(0, 6);
    });
  }, []);

  const removeIncomingOrder = useCallback((orderId: string) => {
    stopRepeatingAlertLoop(orderId);
    setIncomingOrders((previousOrders) => previousOrders.filter((item) => item.id !== orderId));
  }, [stopRepeatingAlertLoop]);

  const normalizeIncomingOrder = useCallback((raw: any): StoreIncomingOrder | null => {
    if (!raw?.id) return null;
    return {
      id: String(raw.id),
      storeId: raw.storeId ? String(raw.storeId) : raw.store?.id ? String(raw.store.id) : undefined,
      store: raw.store && typeof raw.store === "object"
        ? { id: raw.store.id ? String(raw.store.id) : undefined }
        : undefined,
      status: String(raw.status || "PENDING"),
      total: Number(raw.total || 0),
      createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
      items: Array.isArray(raw.items) ? raw.items : [],
    };
  }, []);

  const triggerIncomingOrderAlert = useCallback(async (order: StoreIncomingOrder) => {
    upsertIncomingOrder(order);
    const orderCode = formatStoreOrderCode(order);
    const voiceMessage = buildIncomingOrderVoiceMessage(orderCode);
    const [audioResult, hapticResult] = await Promise.all([
      playIncomingAlertTone({ voiceMessage, orderCode }),
      triggerHaptic(),
    ]);
    setLastDiagnostics(`Audio: ${audioResult.report} || Haptic: ${hapticResult.report}`);

    const isAutoAccepted = order.status === "CONFIRMED";
    showNativeNotification(
      isAutoAccepted ? " Bạn có đơn hàng mới (đã tự nhận)" : " Bạn có đơn hàng mới",
      {
        body: `Đơn #${orderCode} • ${order.total.toLocaleString("vi-VN")}đ`,
      },
    );

    snackbarRef.current.openSnackbar({
      type: "success",
      text: (isAutoAccepted
        ? `Bạn có đơn hàng mới #${orderCode} (đã tự nhận)`
        : `Bạn có đơn hàng mới #${orderCode}`)
        + (audioResult.ok ? "" : " • Âm thanh bị chặn")
        + (hapticResult.ok ? "" : " • Rung bị chặn"),
    });
    startRepeatingAlertLoop(order);
  }, [playIncomingAlertTone, startRepeatingAlertLoop, triggerHaptic, upsertIncomingOrder]);

  const triggerIncomingOrderAlertRef = useRef(triggerIncomingOrderAlert);
  useEffect(() => {
    triggerIncomingOrderAlertRef.current = triggerIncomingOrderAlert;
  }, [triggerIncomingOrderAlert]);

  useEffect(() => {
    const hasSession = !!localStorage.getItem("zaui_food_session");
    if (!hasSession) return;

    requestNotificationPermission();
    requestSendNotification()
      .then(() => setLastDiagnostics((prev) => (prev ? `${prev} || notify:ok` : "notify:ok")))
      .catch((error) => {
        setLastDiagnostics((prev) => {
          const next = `notify:fail(${getErrorMessage(error)})`;
          return prev ? `${prev} || ${next}` : next;
        });
      });

    if (!audioRef.current) {
      audioRef.current = new Audio(ALERT_TONE_DATA_URI);
      audioRef.current.loop = false;
      audioRef.current.preload = "auto";
      audioRef.current.volume = 1;
      audioRef.current.setAttribute("playsinline", "true");
      audioRef.current.setAttribute("webkit-playsinline", "true");
    }
    if (!voiceAudioRef.current) {
      voiceAudioRef.current = new Audio(INCOMING_ORDER_VOICE_ASSET);
      voiceAudioRef.current.loop = false;
      voiceAudioRef.current.preload = "auto";
      voiceAudioRef.current.volume = 1;
      voiceAudioRef.current.setAttribute("playsinline", "true");
      voiceAudioRef.current.setAttribute("webkit-playsinline", "true");
      voiceAudioRef.current.load();
    }

    const socket = initSocket();
    if (!socket) return;

    const handleNewOrder = (order: any) => {
      const normalizedOrder = normalizeIncomingOrder(order);
      if (!normalizedOrder) return;

      knownActionableOrderIdsRef.current.add(normalizedOrder.id);
      void triggerIncomingOrderAlertRef.current(normalizedOrder);
    };

    socket.on("new_order_to_store", handleNewOrder);

    return () => {
      socket.off("new_order_to_store", handleNewOrder);
    };
  }, [normalizeIncomingOrder]);

  const handleOpenPermissionSettings = async () => {
    if (openingPermission) return;
    setOpeningPermission(true);
    try {
      await openPermissionSetting();
    } catch (_error) {
      snackbarRef.current.openSnackbar({
        type: "error",
        text: "Không mở được phần quyền, vui lòng kiểm tra trong cài đặt Zalo",
      });
    } finally {
      setOpeningPermission(false);
    }
  };

  const handleTestSound = async () => {
    const sampleOrderCode = incomingOrders[0]
      ? formatStoreOrderCode(incomingOrders[0])
      : "30124-1234";
    const sampleVoiceMessage = buildIncomingOrderVoiceMessage(sampleOrderCode);
    const result = await playIncomingAlertTone({
      voiceMessage: sampleVoiceMessage,
      orderCode: sampleOrderCode,
    });
    setLastDiagnostics(`Test chuông -> ${result.report}`);
    snackbarRef.current.openSnackbar({
      type: result.ok ? "success" : "error",
      text: result.ok
        ? `Đã gửi lệnh test chuông (đọc mã ${getPickupOrderCodeLast4Digits(sampleOrderCode)})`
        : "Thiết bị đang chặn phát âm thanh (hãy tăng âm lượng media / bỏ im lặng)",
    });
  };

  const handleTestHaptic = async () => {
    const result = await triggerHaptic();
    setLastDiagnostics(`Test rung -> ${result.report}`);
    snackbarRef.current.openSnackbar({
      type: result.ok ? "success" : "error",
      text: result.ok
        ? "Đã gửi lệnh test rung"
        : "Thiết bị/webview đang chặn rung (hãy bật rung hệ thống và haptic touch)",
    });
  };

  useEffect(() => {
    const hasSession = !!localStorage.getItem("zaui_food_session");
    if (!hasSession) return;

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const scanIncomingOrders = async () => {
      try {
        const response = await fetchStoreOrders({ limit: 50 });
        const actionableOrders = (response?.data || [])
          .map(normalizeIncomingOrder)
          .filter((order: StoreIncomingOrder | null): order is StoreIncomingOrder => !!order)
          .filter((order) => order.status === "PENDING" || order.status === "CONFIRMED");

        const nextActionableIds = new Set<string>(
          actionableOrders.map((order) => String(order.id)),
        );
        const previousIds = knownActionableOrderIdsRef.current;

        const shouldNotifyOrder = (order: StoreIncomingOrder) => {
          if (previousIds.has(order.id)) {
            return false;
          }

          if (didBootstrapPollingRef.current) {
            return true;
          }

          // First polling run: still notify orders just created while app already open.
          if (!order.createdAt) {
            return false;
          }

          const createdAtTs = new Date(order.createdAt).getTime();
          if (!Number.isFinite(createdAtTs)) {
            return false;
          }

          return createdAtTs >= mountedAtRef.current - 4000;
        };

        const newOrders = actionableOrders.filter(shouldNotifyOrder);
        for (const order of newOrders) {
          if (stopped) break;
          void triggerIncomingOrderAlertRef.current(order);
        }

        knownActionableOrderIdsRef.current = nextActionableIds;
        didBootstrapPollingRef.current = true;
      } catch (error) {
        const next = `poll:fail(${getErrorMessage(error)})`;
        setLastDiagnostics((prev) => (prev === next ? prev : next));
      }
    };

    const runScanSafely = () => {
      void scanIncomingOrders().catch((error) => {
        const next = `poll:crash(${getErrorMessage(error)})`;
        setLastDiagnostics((prev) => (prev === next ? prev : next));
      });
    };

    runScanSafely();
    pollingInterval = setInterval(runScanSafely, 6000);

    return () => {
      stopped = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [normalizeIncomingOrder]);

  useEffect(() => {
    const unlockAudio = () => {
      warmUpAudio().then((report) => {
        setLastDiagnostics((prev) => (prev ? `${prev} || unlock:${report}` : `unlock:${report}`));
      });
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, [warmUpAudio]);

  useEffect(() => () => {
    repeatAlertStopMapRef.current.forEach((stop) => stop());
    repeatAlertStopMapRef.current.clear();
  }, []);

  const resetProcessing = () => {
    setProcessingOrderId(null);
    setProcessingAction(null);
  };

  const handleViewOrder = (orderId: string) => {
    removeIncomingOrder(orderId);
    navigate(`/order-detail/${orderId}`);
  };

  const requestReason = (title: string, defaultReason: string) => {
    const input = window.prompt(title, defaultReason);
    if (input == null) return null;
    const reason = input.trim();
    if (reason.length < 2) {
      snackbarRef.current.openSnackbar({ type: "warning", text: "Lý do phải từ 2 ký tự" });
      return null;
    }
    return reason;
  };

  const handleOrderAction = async (orderId: string, action: StoreOrderAction) => {
    if (!orderId || processingOrderId || processingAction) return;
    setProcessingOrderId(orderId);
    setProcessingAction(action);

    try {
      if (action === "accept") {
        await confirmStoreOrder(orderId);
        snackbarRef.current.openSnackbar({ type: "success", text: "Đã nhận đơn mới" });
      } else {
        const reason = requestReason("Nhập lý do từ chối đơn", "Quán từ chối đơn");
        if (!reason) {
          resetProcessing();
          return;
        }
        await cancelOrder(orderId, reason);
        snackbarRef.current.openSnackbar({ type: "success", text: "Đã từ chối đơn mới" });
      }
      removeIncomingOrder(orderId);
      resetProcessing();
    } catch (error: any) {
      snackbarRef.current.openSnackbar({
        type: "error",
        text: error?.message || "Không xử lý được đơn hàng",
      });
      resetProcessing();
    }
  };

  if (incomingOrders.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        zIndex: 13000,
        display: "grid",
        gap: 10,
        maxHeight: "45vh",
        overflowY: "auto",
        pointerEvents: "none",
      }}
    >
      {incomingOrders.map((incomingOrder) => {
        const isPending = incomingOrder.status === "PENDING";
        const isProcessingThisOrder = processingOrderId === incomingOrder.id;
        const orderCode = formatStoreOrderCode(incomingOrder);
        return (
          <div
            key={incomingOrder.id}
            className="tm-card tm-glass animate-slide-up"
            style={{
              padding: 12,
              pointerEvents: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontWeight: 700, color: "var(--tm-text-primary)" }}>
                 Đơn mới #{orderCode}
              </Text>
              <Text
                size="xSmall"
                style={{
                  fontWeight: 700,
                  color: isPending ? "#b45309" : "var(--tm-primary)",
                }}
              >
                {isPending ? "Chờ xác nhận" : "Đã tự nhận"}
              </Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <Text size="xSmall" style={{ color: "var(--tm-text-secondary)" }}>
                {(incomingOrder.items?.length || 0)} món
              </Text>
              <Text style={{ fontWeight: 800, color: "var(--tm-primary)" }}>
                <DisplayPrice>{incomingOrder.total || 0}</DisplayPrice>
              </Text>
            </div>

            {isPending ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="tm-interactive"
                  onClick={() => handleOrderAction(incomingOrder.id, "reject")}
                  disabled={isProcessingThisOrder}
                  style={{
                    flex: 1,
                    border: "1px solid #fecdd3",
                    borderRadius: 10,
                    background: "#fff1f2",
                    color: "#e11d48",
                    padding: "10px",
                    fontWeight: 700,
                    opacity: isProcessingThisOrder ? 0.7 : 1,
                  }}
                >
                  {isProcessingThisOrder && processingAction === "reject" ? "Đang xử lý..." : "Từ chối"}
                </button>
                <button
                  className="tm-interactive"
                  onClick={() => handleOrderAction(incomingOrder.id, "accept")}
                  disabled={isProcessingThisOrder}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
                    color: "#fff",
                    padding: "10px",
                    fontWeight: 700,
                    opacity: isProcessingThisOrder ? 0.7 : 1,
                  }}
                >
                  {isProcessingThisOrder && processingAction === "accept" ? "Đang nhận..." : "Nhận đơn"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="tm-interactive"
                  onClick={() => removeIncomingOrder(incomingOrder.id)}
                  style={{
                    flex: 1,
                    border: "1px solid var(--tm-border)",
                    borderRadius: 10,
                    background: "#fff",
                    padding: "10px",
                    fontWeight: 600,
                  }}
                >
                  Tắt thông báo
                </button>
                <button
                  className="tm-interactive"
                  onClick={() => handleViewOrder(incomingOrder.id)}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 10,
                    background: "linear-gradient(135deg, var(--tm-primary), var(--tm-primary-dark))",
                    color: "#fff",
                    padding: "10px",
                    fontWeight: 700,
                  }}
                >
                  Xem đơn
                </button>
              </div>
            )}
          </div>
        );
      })}
      {hasPendingOrder && (
        <div style={{ display: "grid", gap: 8, pointerEvents: "auto" }}>
          <button
            className="tm-interactive"
            onClick={handleTestSound}
            style={{
              border: "1px solid var(--tm-border)",
              borderRadius: 12,
              background: "#fff",
              color: "var(--tm-text-primary)",
              padding: "10px 12px",
              fontWeight: 700,
            }}
          >
            Kiểm tra chuông
          </button>
          <button
            className="tm-interactive"
            onClick={handleTestHaptic}
            style={{
              border: "1px solid var(--tm-border)",
              borderRadius: 12,
              background: "#fff",
              color: "var(--tm-text-primary)",
              padding: "10px 12px",
              fontWeight: 700,
            }}
          >
            Kiểm tra rung
          </button>
          <button
            className="tm-interactive"
            onClick={handleOpenPermissionSettings}
            style={{
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              background: "#eff6ff",
              color: "#1d4ed8",
              padding: "10px 12px",
              fontWeight: 700,
            }}
          >
            {openingPermission ? "Đang mở quyền..." : "Bật quyền chuông/rung"}
          </button>
          <button
            className="tm-interactive"
            onClick={() => navigate("/orders")}
            style={{
              border: "none",
              borderRadius: 12,
              background: "var(--tm-primary)",
              color: "#fff",
              padding: "10px 12px",
              fontWeight: 700,
            }}
          >
            Mở danh sách đơn hàng
          </button>
          {!!lastDiagnostics && (
            <Text size="xxSmall" style={{ color: "var(--tm-text-secondary)" }}>
              {lastDiagnostics}
            </Text>
          )}
        </div>
      )}
    </div>
  );
};
