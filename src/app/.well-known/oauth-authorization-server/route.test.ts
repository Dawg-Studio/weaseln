import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("authorization server metadata", () => {
    it("advertises client ID metadata documents and public clients", async () => {
        const res = await GET(
            new Request(
                "https://weaseln.test/.well-known/oauth-authorization-server",
            ),
        );
        const body = await res.json();
        expect(body.client_id_metadata_document_supported).toBe(true);
        expect(body.token_endpoint_auth_methods_supported).toContain("none");
    });

    it("keeps the confidential methods", async () => {
        const res = await GET(
            new Request(
                "https://weaseln.test/.well-known/oauth-authorization-server",
            ),
        );
        const body = await res.json();
        expect(body.token_endpoint_auth_methods_supported).toEqual(
            expect.arrayContaining([
                "client_secret_basic",
                "client_secret_post",
            ]),
        );
    });
});
