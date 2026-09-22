"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVolumeHigh, faRotate, faPause, faPlay, faCircleNotch } from "@fortawesome/free-solid-svg-icons";

type AudioStatus = {
    audioUrl: string | null;
    audioStatus: string;
    audioProvider: string | null;
    audioGeneratedAt: string | null;
    audioDurationMs: number | null;
    audioError: string | null;
};

export default function PostAudioPlayer({
    postId,
    plainText,
    initialAudioUrl,
    initialStatus,
}: {
    postId: string;
    plainText?: string;
    initialAudioUrl?: string | null;
    initialStatus?: string | null;
}) {
    const [status, setStatus] = useState<AudioStatus | null>(
        initialAudioUrl || initialStatus
            ? {
                  audioUrl: initialAudioUrl ?? null,
                  audioStatus: initialStatus ?? (initialAudioUrl ? "ready" : "none"),
                  audioProvider: null,
                  audioGeneratedAt: null,
                  audioDurationMs: null,
                  audioError: null,
              }
            : null,
    );
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Browser TTS via speechSynthesis
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/post/audio?postId=${encodeURIComponent(postId)}`, { cache: "no-store" });
            if (!res.ok) return;
            const json = await res.json();
            if (json?.data) setStatus(json.data as AudioStatus);
        } catch {
            // ignore
        }
    }, [postId]);

    useEffect(() => {
        // Fetch current audio status once on mount. This synchronizes with the
        // server's Post.audio* fields (external system), not derived React state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchStatus();
    }, [fetchStatus]);

    const handleGenerate = useCallback(
        async (force = false) => {
            setGenerating(true);
            setError(null);
            setInfo(null);
            try {
                const res = await fetch("/api/post/audio", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ postId, force }),
                });
                const json = await res.json();
                if (!res.ok) {
                    const code = json?.code as string | undefined;
                    const msg: string = json?.message ?? `Failed (${res.status})`;
                    if (code === "UNAUTHORIZED") {
                        setError("Sign in to generate audio.");
                    } else if (code === "RATE_LIMITED") {
                        setError(msg);
                    } else if (code === "UNSUPPORTED_CONTENT" || code === "TOO_LONG" || code === "EMPTY_CONTENT") {
                        setError(msg);
                    } else if (code === "UNAVAILABLE") {
                        setError(msg + " Try browser voice below.");
                    } else if (code === "GENERATION_FAILED" || code === "TIMEOUT") {
                        setError(msg);
                    } else {
                        setError(msg);
                    }
                    await fetchStatus();
                    return;
                }
                setInfo(json?.data?.cached ? "Audio already ready." : "Audio generated.");
                await fetchStatus();
            } catch (e) {
                setError(e instanceof Error ? e.message : "Network error");
            } finally {
                setGenerating(false);
            }
        },
        [postId, fetchStatus],
    );

    const handleBrowserSpeak = useCallback(() => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
            setError("Browser speech synthesis is not supported in this browser.");
            return;
        }
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
            return;
        }
        // Prefer explicit plainText; otherwise scrape article text.
        let text = plainText?.trim() ?? "";
        if (!text) {
            const article = document.querySelector("article");
            text = article?.textContent?.trim() ?? document.body.innerText.slice(0, 5000);
        }
        text = text.slice(0, 5000);
        if (!text) {
            setError("No text available for browser voice.");
            return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        u.onend = () => setIsSpeaking(false);
        u.onerror = () => setIsSpeaking(false);
        utteranceRef.current = u;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        setIsSpeaking(true);
        setError(null);
        setInfo("Playing with browser voice (no server cost).");
    }, [plainText, isSpeaking]);

    useEffect(() => {
        return () => {
            if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
        };
    }, []);

    const audioUrl = status?.audioUrl ?? null;
    const audioState = status?.audioStatus ?? "none";

    return (
        <section
            aria-label="Text-to-audio"
            className="not-prose my-6 rounded-box border border-hairline bg-base-200/50 p-4"
        >
            <div className="flex flex-wrap items-center gap-3">
                <FontAwesomeIcon icon={faVolumeHigh} className="text-primary" title="Audio" />
                <h2 className="text-sm font-semibold text-base-content">Listen</h2>
                <span className="text-xs text-muted">
                    {audioState === "ready" && audioUrl ? "Audio ready" : audioState === "generating" ? "Generating…" : "Convert this post to audio"}
                </span>
                <span className="ml-auto flex items-center gap-2">
                    {!audioUrl || audioState !== "ready" ? (
                        <button
                            onClick={() => handleGenerate(false)}
                            disabled={generating || audioState === "generating"}
                            className="btn btn-sm btn-primary rounded-field press"
                            aria-label="Generate audio for this post"
                            type="button"
                        >
                            {generating || audioState === "generating" ? (
                                <>
                                    <FontAwesomeIcon icon={faCircleNotch} spin /> Generating…
                                </>
                            ) : (
                                <>
                                    <FontAwesomeIcon icon={faVolumeHigh} /> Generate audio
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={() => handleGenerate(true)}
                            disabled={generating}
                            className="btn btn-sm btn-ghost rounded-field border border-hairline bg-surface press"
                            aria-label="Regenerate audio for this post"
                            type="button"
                        >
                            <FontAwesomeIcon icon={faRotate} /> Regenerate
                        </button>
                    )}
                    <button
                        onClick={handleBrowserSpeak}
                        className="btn btn-sm btn-outline rounded-field border-hairline-strong bg-transparent press"
                        aria-label={isSpeaking ? "Stop browser voice" : "Listen with browser voice"}
                        type="button"
                    >
                        <FontAwesomeIcon icon={isSpeaking ? faPause : faPlay} /> {isSpeaking ? "Stop" : "Browser voice"}
                    </button>
                </span>
            </div>

            {audioUrl && audioState === "ready" && (
                <div className="mt-3">
                    <audio
                        ref={audioRef}
                        controls
                        preload="metadata"
                        src={audioUrl}
                        className="w-full rounded-field"
                        aria-label="Post audio player"
                    />
                    <p className="mt-1 text-xs text-muted">
                        {status?.audioProvider ? `via ${status.audioProvider}` : null}
                        {status?.audioDurationMs ? ` · ${Math.round((status.audioDurationMs ?? 0) / 1000)}s` : null}
                        {status?.audioGeneratedAt ? ` · generated ${new Date(status.audioGeneratedAt).toLocaleString()}` : null}
                    </p>
                </div>
            )}

            {audioState === "failed" && status?.audioError && (
                <div role="alert" className="alert alert-error mt-3 py-2 text-sm">
                    <span>Generation failed: {status.audioError}</span>
                </div>
            )}

            {error && (
                <div role="alert" className="alert alert-warning mt-3 py-2 text-sm">
                    <span>{error}</span>
                </div>
            )}

            {info && !error && (
                <div role="status" className="alert mt-3 py-2 text-sm">
                    <span>{info}</span>
                </div>
            )}

            <p className="mt-3 text-xs text-muted">
                Eligible text: title + description + body (max 5000 chars). Generating audio is rate-limited (10/hour per user, 5/hour per post) and does not
                block publishing or reading.
            </p>
        </section>
    );
}
