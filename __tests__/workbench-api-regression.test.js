import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApiMiddleware } from "../scripts/tools/api-middleware.js";
import { getDevSessionToken } from "../scripts/tools/safety.js";
import { installComponent } from "../scripts/tools/component-service.js";
import { buildWorkbench } from "../scripts/builders/workbench.js";

import * as services from "../scripts/tools/component-service.js";
import * as preview from "../scripts/builders/workbench.js";
import * as snippets from "../scripts/sync-snippets.js";

beforeEach(() => {
    vi.spyOn(services, "installComponent");
    vi.spyOn(services, "deleteAllWorkbenchComponents");
    vi.spyOn(preview, "buildWorkbench");
    vi.spyOn(snippets, "syncSnippets").mockReturnValue({});
});
afterEach(() => vi.restoreAllMocks());
async function requestImport(
    url = "/__api/import",
    payload = { component: "alpha" },
    method = "POST",
    token = getDevSessionToken(),
) {
    const body = JSON.stringify(payload);
    const req = {
        url,
        method,
        headers: {
            host: "localhost:8686",
            "x-workbench-token": token,
        },
        on(event, fn) {
            if (event === "data") fn(Buffer.from(body));
            if (event === "end") fn();
        },
    };
    let status, result;
    const res = {
        writeHead(code) {
            status = code;
        },
        end(json) {
            result = JSON.parse(json);
        },
    };
    await createApiMiddleware()(req, res, () => {});
    return { status, result };
}

describe("Workbench mutation reporting", () => {
    it("reports a saved mutation and an explicit preview warning when rebuild fails", async () => {
        installComponent.mockReturnValue({
            success: true,
            message: "Installed alpha",
        });
        buildWorkbench.mockRejectedValue(
            new Error("Preview stylesheet failed"),
        );
        const { status, result } = await requestImport();
        expect(status).toBe(200);
        expect(result.success).toBe(true);
        expect(result.warnings).toContain("Preview: Preview stylesheet failed");
        expect(result.message).toContain("Preview stylesheet failed");
    });
    it("keeps conflicts as 409 and does not rebuild after a rejected mutation", async () => {
        installComponent.mockReturnValue({
            success: false,
            conflict: true,
            message: "Custom code preserved",
        });
        const { status, result } = await requestImport();
        expect(status).toBe(409);
        expect(result.success).toBe(false);
        expect(buildWorkbench).not.toHaveBeenCalled();
    });
    it("returns success without warnings when both mutation and preview succeed", async () => {
        installComponent.mockReturnValue({
            success: true,
            message: "Installed alpha",
        });
        buildWorkbench.mockResolvedValue(undefined);
        const { status, result } = await requestImport();
        expect(status).toBe(200);
        expect(result.warnings).toEqual([]);
        expect(buildWorkbench).toHaveBeenCalledTimes(1);
    });
    it("protects bulk clear with token, POST and explicit confirmation", async () => {
        const revision = "a".repeat(64);
        expect(
            (
                await requestImport(
                    "/__api/clear-workbench",
                    { confirm: true, revision },
                    "GET",
                )
            ).status,
        ).toBe(405);
        expect(
            (
                await requestImport(
                    "/__api/clear-workbench",
                    { confirm: true, revision },
                    "POST",
                    "invalid",
                )
            ).status,
        ).toBe(401);
        expect(
            (await requestImport("/__api/clear-workbench", { revision }))
                .status,
        ).toBe(400);
        expect(services.deleteAllWorkbenchComponents).not.toHaveBeenCalled();
    });
    it("performs one bulk mutation and only one preview rebuild", async () => {
        const revision = "a".repeat(64);
        services.deleteAllWorkbenchComponents.mockReturnValue({
            success: true,
            deletedCount: 3,
            message: "Cleared",
        });
        buildWorkbench.mockResolvedValue(undefined);
        const { status, result } = await requestImport(
            "/__api/clear-workbench",
            { confirm: true, revision },
        );
        expect(status).toBe(200);
        expect(result.deletedCount).toBe(3);
        expect(
            services.deleteAllWorkbenchComponents,
        ).toHaveBeenCalledExactlyOnceWith({ revision });
        expect(buildWorkbench).toHaveBeenCalledTimes(1);
    });
    it("returns 409 without rebuilding if the bulk clear revision is stale", async () => {
        services.deleteAllWorkbenchComponents.mockReturnValue({
            success: false,
            conflict: true,
            message: "Reload library",
        });
        expect(
            (
                await requestImport("/__api/clear-workbench", {
                    confirm: true,
                    revision: "a".repeat(64),
                })
            ).status,
        ).toBe(409);
        expect(buildWorkbench).not.toHaveBeenCalled();
    });
});
