import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "./route";
import { DEFAULT_PROFILE_CUSTOMIZATION } from "@/modules/profile-customization/validation";

const mockAuth = vi.fn();
const mockUpsert = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/db", () => ({
  default: {
    userProfileCustomization: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

describe("profile-customization API", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockUpsert.mockReset();
    mockFindUnique.mockReset();
    mockUpdate.mockReset();
  });

  it("GET returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET returns defaults when no row exists", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockFindUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(DEFAULT_PROFILE_CUSTOMIZATION);
  });

  it("PATCH returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const req = new Request("http://localhost/api/user/profile-customization", {
      method: "PATCH",
      body: JSON.stringify({ preset: "editorial" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("PATCH returns 400 on invalid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const req = new Request("http://localhost/api/user/profile-customization", {
      method: "PATCH",
      body: JSON.stringify({ backgroundImage: "javascript:alert(1)" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("PATCH upserts for the session user only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockUpsert.mockResolvedValue({ id: "row1", userId: "u1" });
    const req = new Request("http://localhost/api/user/profile-customization", {
      method: "PATCH",
      body: JSON.stringify({ preset: "editorial", backgroundColor: "#ff0000" }),
    });
    await PATCH(req);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const args = mockUpsert.mock.calls[0][0];
    expect(args.where.userId).toBe("u1");
    expect(args.create.preset).toBe("editorial");
    expect(args.update.preset).toBe("editorial");
  });

  it("DELETE returns 401 when no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("DELETE resets to defaults without deleting the user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockUpdate.mockResolvedValue({ userId: "u1" });
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const args = mockUpdate.mock.calls[0][0];
    expect(args.where.userId).toBe("u1");
    expect(args.data.preset).toBe(DEFAULT_PROFILE_CUSTOMIZATION.preset);
    expect(args.data.layout).toEqual(DEFAULT_PROFILE_CUSTOMIZATION.layout);
  });
});
