import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateRoomName,
  generateParticipantIdentity,
  fetchToken,
} from "../livekit";

describe("livekit utilities", () => {
  describe("generateRoomName", () => {
    it("should return a string starting with 'siestai-'", () => {
      const name = generateRoomName();
      expect(name).toMatch(/^siestai-/);
    });

    it("should produce different values on successive calls", () => {
      const a = generateRoomName();
      const b = generateRoomName();
      expect(a).not.toBe(b);
    });
  });

  describe("generateParticipantIdentity", () => {
    it("should return a string starting with 'user-'", () => {
      const identity = generateParticipantIdentity();
      expect(identity).toMatch(/^user-/);
    });

    it("should produce different values on successive calls", () => {
      const a = generateParticipantIdentity();
      const b = generateParticipantIdentity();
      expect(a).not.toBe(b);
    });
  });

  describe("fetchToken", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should return parsed TokenResponse on successful fetch", async () => {
      const mockResponse = {
        token: "jwt-token",
        serverUrl: "wss://test.livekit.cloud",
        roomName: "test-room",
      };

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        }),
      );

      const result = await fetchToken({
        roomName: "test-room",
        identity: "user1",
      });

      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/livekit/token"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: "test-room", identity: "user1" }),
        }),
      );
    });

    it("should throw descriptive error when response is not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        }),
      );

      await expect(
        fetchToken({ roomName: "test-room", identity: "user1" }),
      ).rejects.toThrow("Failed to fetch LiveKit token: 401 Unauthorized");
    });

    it("should propagate network errors when fetch throws", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      );

      await expect(
        fetchToken({ roomName: "test-room", identity: "user1" }),
      ).rejects.toThrow("Failed to fetch");
    });
  });
});
