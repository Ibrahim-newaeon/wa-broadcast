import { describe, it, expect } from "vitest";
import { normalizeInbound, previewFor } from "./inboundMessage";

describe("normalizeInbound", () => {
  it("text message keeps its body", () => {
    const n = normalizeInbound({ from: "1555", type: "text", text: { body: "hello there" } });
    expect(n).toMatchObject({ type: "text", text: "hello there" });
    expect(previewFor(n)).toBe("hello there");
  });

  it("image carries id/mime and uses caption as text", () => {
    const n = normalizeInbound({ from: "1555", type: "image", image: { id: "M1", mime_type: "image/jpeg", caption: "nice" } });
    expect(n).toMatchObject({ type: "image", text: "nice", mediaId: "M1", mediaMime: "image/jpeg" });
  });

  it("document keeps the filename and previews with an icon when no caption", () => {
    const n = normalizeInbound({ from: "1555", type: "document", document: { id: "D1", filename: "menu.pdf", mime_type: "application/pdf" } });
    expect(n).toMatchObject({ type: "document", mediaId: "D1", mediaFilename: "menu.pdf", text: null });
    expect(previewFor(n)).toBe("📄 Document");
  });

  it("reaction stores the emoji", () => {
    const n = normalizeInbound({ from: "1555", type: "reaction", reaction: { emoji: "👍", message_id: "x" } });
    expect(n).toMatchObject({ type: "reaction", text: "👍" });
  });

  it("interactive reply uses the button/list title", () => {
    const n = normalizeInbound({ from: "1555", type: "interactive", interactive: { button_reply: { title: "Yes" } } });
    expect(n).toMatchObject({ type: "interactive", text: "Yes" });
  });

  it("location previews with a pin when unnamed", () => {
    const n = normalizeInbound({ from: "1555", type: "location", location: { latitude: 1, longitude: 2 } });
    expect(n.type).toBe("location");
    expect(previewFor(n)).toBe("📍 Location");
  });

  it("voice note has no text and previews as a voice message", () => {
    const n = normalizeInbound({ from: "1555", type: "audio", audio: { id: "A1", mime_type: "audio/ogg" } });
    expect(n).toMatchObject({ type: "audio", text: null, mediaId: "A1" });
    expect(previewFor(n)).toBe("🎙️ Voice message");
  });
});
