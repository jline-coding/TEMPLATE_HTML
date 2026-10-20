import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import { resolve, join } from "path";
import { createHash } from "crypto";
import {
    installComponent,
    installVariant,
    removeComponent,
    saveComponent,
    deleteWorkbenchComponent,
    deleteAllWorkbenchComponents,
    getWorkbenchRevision,
    deleteWorkbenchVariant,
    getRegistry,
    stripEjsShowroomWrapper,
    sliceJsForComponent,
    compareComponentVersions,
} from "../scripts/tools/component-service.js";
import { PROJECT_ROOT, safeRmDirSync } from "../scripts/tools/safety.js";
import { InstallTransaction } from "../scripts/tools/components/transaction.js";

const { actualFs } = vi.hoisted(() => ({ actualFs: {} }));
vi.mock("fs", async (original) => {
    const actual = await original();
    actualFs.writeFileSync = actual.writeFileSync;
    actualFs.unlinkSync = actual.unlinkSync;
    return {
        ...actual,
        writeFileSync: vi.fn(actual.writeFileSync),
        unlinkSync: vi.fn(actual.unlinkSync),
    };
});
let paths;
function write(dir, file, content) {
    fs.writeFileSync(join(dir, file), content, "utf8");
}
function read(dir, file) {
    return fs.readFileSync(join(dir, file), "utf8");
}
function fixture(
    name,
    meta = {},
    scss = `.c-${name} { color: red; }`,
    html = `<div class="c-${name}"><span>${name}</span></div>`,
) {
    write(
        paths.wbComponentsDir,
        `_${name}.ejs`,
        (Object.keys(meta).length
            ? `<!--\n---\n${Object.entries(meta)
                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                  .join("\n")}\n---\n-->\n`
            : "") + html,
    );
    if (scss !== null)
        write(
            meta.category === "layout" ? paths.wbLayoutDir : paths.wbScssDir,
            meta.scss || `_${name}.scss`,
            scss,
        );
}
function backupFiles() {
    const root = join(paths.wbDir, ".backup");
    return fs.readdirSync(root).map((dir) => join(root, dir));
}

beforeEach(() => {
    fs.writeFileSync.mockImplementation(actualFs.writeFileSync);
    fs.unlinkSync.mockImplementation(actualFs.unlinkSync);
    const root = fs.mkdtempSync(
        resolve(PROJECT_ROOT, "test-sandbox-wb-regression-"),
    );
    paths = {
        root,
        wbDir: join(root, "workbench"),
        wbComponentsDir: join(root, "workbench/components"),
        wbScssDir: join(root, "workbench/scss/component"),
        wbLayoutDir: join(root, "workbench/scss/layout"),
        wbJsDir: join(root, "workbench/js"),
        clientComponentsDir: join(root, "src/components"),
        clientScssDir: join(root, "src/pages/assets/scss/component"),
        clientLayoutDir: join(root, "src/pages/assets/scss/layout"),
        clientJsDir: join(root, "src/pages/assets/js/component"),
    };
    Object.values(paths).forEach((dir) =>
        fs.mkdirSync(dir, { recursive: true }),
    );
});
afterEach(() => {
    fs.writeFileSync.mockImplementation(actualFs.writeFileSync);
    fs.unlinkSync.mockImplementation(actualFs.unlinkSync);
    safeRmDirSync(paths.root, PROJECT_ROOT);
    vi.restoreAllMocks();
});

describe("Clear entire workbench library", () => {
    it("removes uniquely owned JS files containing grouped variant module markers", () => {
        fixture("form");
        write(
            paths.wbJsDir,
            "form.js",
            '/* [Component: fileInput] */\nconsole.log("form variant");',
        );
        const result = deleteAllWorkbenchComponents({}, paths);
        expect(result.success).toBe(true);
        expect(result.warnings).toEqual([]);
        expect(fs.existsSync(join(paths.wbJsDir, "form.js"))).toBe(false);
        expect(read(backupFiles()[0], "form.js")).toContain("form variant");
    });

    it("removes namespaced and forwarded imports while preserving unrelated index directives", () => {
        fixture("alpha");
        write(
            paths.wbScssDir,
            "_index.scss",
            '@use "alpha" as *;\n@forward "./_alpha.scss" show example;\n@use "other";\n',
        );
        expect(deleteAllWorkbenchComponents({}, paths).success).toBe(true);
        expect(read(paths.wbScssDir, "_index.scss")).toBe('@use "other";\n');
    });

    it("clears registered components once, backs up files and preserves src, scaffolding and unrelated JS", () => {
        fixture("alpha", { scss: "_shared.scss", js: "common.js" });
        fixture("beta", { scss: "_shared.scss", js: "common.js" });
        write(
            paths.wbScssDir,
            "_index.scss",
            '// Keep this comment\n@use "shared";\n',
        );
        write(
            paths.wbLayoutDir,
            "_container.scss",
            ".l-container {width:100%;}",
        );
        write(paths.wbLayoutDir, "_index.scss", '@use "container";\n');
        write(paths.wbDir, "workbench.scss", '@use "scss/layout";');
        write(paths.clientComponentsDir, "_alpha.ejs", "CLIENT MUST SURVIVE");
        const common =
            '// Global utility\n/* [Component: alpha] */\nconsole.log("alpha");\n/* [Component: beta] */\nconsole.log("beta");\n/* [Component: unrelated] */\nconsole.log("keep");';
        write(paths.wbJsDir, "common.js", common);
        const result = deleteAllWorkbenchComponents(
            { revision: getWorkbenchRevision(paths) },
            paths,
        );
        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(2);
        expect(getRegistry(paths)).toEqual([]);
        expect(read(paths.clientComponentsDir, "_alpha.ejs")).toBe(
            "CLIENT MUST SURVIVE",
        );
        expect(read(paths.wbLayoutDir, "_container.scss")).toContain(
            ".l-container",
        );
        expect(read(paths.wbLayoutDir, "_index.scss")).toBe(
            '@use "container";\n',
        );
        expect(read(paths.wbDir, "workbench.scss")).toBe('@use "scss/layout";');
        expect(read(paths.wbScssDir, "_index.scss")).toBe(
            "// Keep this comment\n",
        );
        expect(read(paths.wbJsDir, "common.js")).toContain("// Global utility");
        expect(read(paths.wbJsDir, "common.js")).toContain(
            'console.log("keep")',
        );
        expect(read(paths.wbJsDir, "common.js")).not.toContain(
            'console.log("alpha")',
        );
        expect(read(paths.wbJsDir, "common.js")).not.toContain(
            'console.log("beta")',
        );
        expect(backupFiles()).toHaveLength(1);
        expect(read(backupFiles()[0], "common.js")).toBe(common);
        const manifest = JSON.parse(read(backupFiles()[0], "manifest.json"));
        expect(
            manifest.files.map((f) => f.original.replace(/\\/g, "/")),
        ).toContain("workbench/scss/component/_shared.scss");
    });
    it("rejects a stale library revision without deleting any component", () => {
        fixture("alpha");
        const revision = getWorkbenchRevision(paths);
        fixture("beta");
        const result = deleteAllWorkbenchComponents({ revision }, paths);
        expect(result.conflict).toBe(true);
        expect(getRegistry(paths)).toHaveLength(2);
        expect(fs.existsSync(join(paths.wbDir, ".backup"))).toBe(false);
    });
    it("rolls back all file removals and index edits when a later deletion fails", () => {
        fixture("alpha");
        fixture("beta");
        const index = '@use "alpha";\n@use "beta";\n';
        write(paths.wbScssDir, "_index.scss", index);
        let failed = false;
        fs.unlinkSync.mockImplementation((file) => {
            if (!failed && file === join(paths.wbComponentsDir, "_beta.ejs")) {
                failed = true;
                throw new Error("Deletion failure");
            }
            return actualFs.unlinkSync(file);
        });
        const result = deleteAllWorkbenchComponents({}, paths);
        expect(failed).toBe(true);
        expect(result.success).toBe(false);
        expect(result.rolledBack).toBe(true);
        expect(getRegistry(paths)).toHaveLength(2);
        expect(read(paths.wbScssDir, "_index.scss")).toBe(index);
        expect(read(paths.wbScssDir, "_alpha.scss")).toContain(".c-alpha");
    });
    it("does not delete anything if the snapshot cannot be completed", () => {
        fixture("alpha");
        fs.writeFileSync.mockImplementation((file, ...args) => {
            if (String(file).endsWith("manifest.json"))
                throw new Error("Backup disk unavailable");
            return actualFs.writeFileSync(file, ...args);
        });
        const result = deleteAllWorkbenchComponents({}, paths);
        expect(result.success).toBe(false);
        expect(getRegistry(paths)).toHaveLength(1);
    });
    it("keeps base container styling even if it has a registered preview", () => {
        fixture(
            "container",
            { category: "layout" },
            ".l-container {width:100%;}",
            '<div class="l-container">Layout</div>',
        );
        write(paths.wbLayoutDir, "_index.scss", '@use "container";\n');
        const result = deleteAllWorkbenchComponents({}, paths);
        expect(result.success).toBe(true);
        expect(getRegistry(paths)).toEqual([]);
        expect(read(paths.wbLayoutDir, "_container.scss")).toContain(
            ".l-container",
        );
        expect(read(paths.wbLayoutDir, "_index.scss")).toContain(
            '@use "container"',
        );
        expect(deleteAllWorkbenchComponents({}, paths).deletedCount).toBe(0);
    });
    it("preserves shared scripts without module markers and returns a warning", () => {
        fixture("alpha", { js: "common.js" });
        write(paths.wbJsDir, "common.js", "window.keepUtility=true;");
        const result = deleteAllWorkbenchComponents({}, paths);
        expect(result.success).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(read(paths.wbJsDir, "common.js")).toBe(
            "window.keepUtility=true;",
        );
        expect(getRegistry(paths)).toEqual([]);
    });
});

describe("Workbench data preservation regressions", () => {
    it("preserves plain div HTML and unwraps multiple balanced showroom items", () => {
        const html = '<div class="c-any"><div>Nested</div></div>';
        expect(stripEjsShowroomWrapper(html)).toBe(html);
        const wrapped = `<div class="p-component__item">${html}</div>\n<div class="p-component__item">${html}</div>`;
        expect(stripEjsShowroomWrapper(wrapped)).toBe(`${html}\n${html}`);
        fixture("any", {}, ".c-any { color:red; }", html);
        expect(
            installComponent("any", { includeEjs: true }, paths).success,
        ).toBe(true);
        expect(read(paths.clientComponentsDir, "_any.ejs")).toBe(html);
    });

    it("backs up real files and removes only the requested module from shared JS", () => {
        fixture("alpha", { js: "common.js" });
        fixture("beta", { js: "common.js" });
        const js =
            '// global setup\n/* [Component: alpha] */\nconsole.log("alpha");\n/* [Component: beta] */\nconsole.log("beta");';
        write(paths.wbJsDir, "common.js", js);
        const result = deleteWorkbenchComponent("alpha", {}, paths);
        expect(result.success).toBe(true);
        const remaining = read(paths.wbJsDir, "common.js");
        expect(remaining).toContain("// global setup");
        expect(remaining).not.toContain('console.log("alpha")');
        expect(remaining).toContain("/* [Component: beta] */");
        expect(remaining).toContain('console.log("beta")');
        expect(read(backupFiles()[0], "common.js")).toBe(js);
        expect(getRegistry(paths).map((c) => c.name)).toEqual(["beta"]);
    });

    it("preserves unmarked shared JS instead of guessing ownership", () => {
        fixture("alpha", { js: "common.js" });
        fixture("beta", { js: "common.js" });
        write(paths.wbJsDir, "common.js", "window.sharedUtility = true;");
        const result = deleteWorkbenchComponent("alpha", {}, paths);
        expect(result.success).toBe(true);
        expect(result.warnings).not.toHaveLength(0);
        expect(read(paths.wbJsDir, "common.js")).toBe(
            "window.sharedUtility = true;",
        );
    });

    it("keeps shared SCSS and its index for remaining components", () => {
        fixture("alpha", { scss: "_shared.scss" });
        fixture("beta", { scss: "_shared.scss" });
        write(paths.wbScssDir, "_index.scss", '@use "shared";\n');
        expect(deleteWorkbenchComponent("alpha", {}, paths).success).toBe(true);
        expect(fs.existsSync(join(paths.wbScssDir, "_shared.scss"))).toBe(true);
        expect(read(paths.wbScssDir, "_index.scss")).toContain('@use "shared"');
    });

    it("blocks removal of customized EJS without force and keeps all files", () => {
        fixture("alpha");
        write(paths.clientScssDir, "_alpha.scss", ".c-alpha { color: red; }");
        const customized = '<div class="c-alpha">Custom content</div>';
        write(paths.clientComponentsDir, "_alpha.ejs", customized);
        const result = removeComponent("alpha", {}, paths);
        expect(result.conflict).toBe(true);
        expect(read(paths.clientComponentsDir, "_alpha.ejs")).toBe(customized);
        expect(fs.existsSync(join(paths.clientScssDir, "_alpha.scss"))).toBe(
            true,
        );
        expect(removeComponent("alpha", { force: true }, paths).success).toBe(
            true,
        );
        expect(read(backupFiles()[0], "_alpha.ejs")).toBe(customized);
    });

    it("round-trips JS imported into common.js and removes only its own module", () => {
        fixture("alpha");
        write(paths.wbJsDir, "alpha.js", 'console.log("alpha");');
        expect(
            installComponent(
                "alpha",
                { targetJsFile: "common.js", includeEjs: true },
                paths,
            ).success,
        ).toBe(true);
        fs.unlinkSync(join(paths.wbJsDir, "alpha.js"));
        const result = saveComponent("alpha", { force: true }, paths);
        expect(result.success).toBe(true);
        expect(result.savedFiles).toContain("workbench/js/alpha.js");
        expect(read(paths.wbJsDir, "alpha.js")).toContain(
            'console.log("alpha")',
        );
        const commonDir = join(paths.root, "src/pages/assets/js");
        write(
            commonDir,
            "common.js",
            read(commonDir, "common.js") +
                '\n/* [Component: beta] */\nconsole.log("beta");',
        );
        expect(removeComponent("alpha", { force: true }, paths).success).toBe(
            true,
        );
        expect(read(commonDir, "common.js")).not.toContain(
            'console.log("alpha")',
        );
        expect(read(commonDir, "common.js")).toContain('console.log("beta")');
    });

    it("blocks overwriting customized workbench EJS without force", () => {
        fixture("alpha");
        write(
            paths.clientComponentsDir,
            "_alpha.ejs",
            '<div class="c-alpha">New content</div>',
        );
        const before = read(paths.wbComponentsDir, "_alpha.ejs");
        expect(saveComponent("alpha", {}, paths).conflict).toBe(true);
        expect(read(paths.wbComponentsDir, "_alpha.ejs")).toBe(before);
    });

    it("rolls back already-written EJS when a later save step fails", () => {
        fixture("alpha");
        write(
            paths.clientComponentsDir,
            "_alpha.ejs",
            '<div class="c-alpha">New content</div>',
        );
        write(paths.clientScssDir, "_alpha.scss", ".c-alpha {color:blue;}");
        const before = read(paths.wbComponentsDir, "_alpha.ejs");
        let failed = false;
        fs.writeFileSync.mockImplementation((file, ...args) => {
            if (!failed && file === join(paths.wbScssDir, "_alpha.scss")) {
                failed = true;
                throw new Error("Simulated disk write failure");
            }
            return actualFs.writeFileSync(file, ...args);
        });
        const result = saveComponent("alpha", { force: true }, paths);
        expect(failed).toBe(true);
        expect(result.success).toBe(false);
        expect(result.rolledBack).toBe(true);
        expect(read(paths.wbComponentsDir, "_alpha.ejs")).toBe(before);
    });

    it("rolls back removal when a later unlink fails", () => {
        fixture("alpha");
        write(paths.clientScssDir, "_alpha.scss", ".c-alpha {color:red;}");
        write(
            paths.clientComponentsDir,
            "_alpha.ejs",
            '<div class="c-alpha">Custom</div>',
        );
        let failed = false;
        fs.unlinkSync.mockImplementation((file) => {
            if (
                !failed &&
                file === join(paths.clientComponentsDir, "_alpha.ejs")
            ) {
                failed = true;
                throw new Error("Simulated unlink failure");
            }
            return actualFs.unlinkSync(file);
        });
        const result = removeComponent("alpha", { force: true }, paths);
        expect(result.success).toBe(false);
        expect(result.rolledBack).toBe(true);
        expect(read(paths.clientScssDir, "_alpha.scss")).toContain(".c-alpha");
        expect(read(paths.clientComponentsDir, "_alpha.ejs")).toContain(
            "Custom",
        );
    });

    it("rejects stale variant indexes and changed source revisions without writing", () => {
        const html =
            '<div class="p-component__item"><div class="c-alpha">A</div></div>\n<div class="p-component__item"><div class="c-beta">B</div></div>';
        fixture(
            "cards",
            {},
            ".c-alpha {color:red;}\n.c-beta {color:blue;}",
            html,
        );
        const before = read(paths.wbComponentsDir, "_cards.ejs");
        expect(
            deleteWorkbenchVariant(
                { component: "cards", classStr: "c-beta", cardIndex: 0 },
                paths,
            ).conflict,
        ).toBe(true);
        const revision = createHash("sha256")
            .update("old content")
            .digest("hex");
        expect(
            deleteWorkbenchVariant(
                {
                    component: "cards",
                    classStr: "c-beta",
                    cardIndex: 1,
                    revision,
                },
                paths,
            ).conflict,
        ).toBe(true);
        expect(read(paths.wbComponentsDir, "_cards.ejs")).toBe(before);
        expect(
            deleteWorkbenchVariant(
                { component: "cards", classStr: "c-beta", cardIndex: 1 },
                paths,
            ).success,
        ).toBe(true);
        expect(read(paths.wbComponentsDir, "_cards.ejs")).toContain("c-alpha");
        expect(read(paths.wbComponentsDir, "_cards.ejs")).not.toContain(
            "c-beta",
        );
    });

    it("installs custom layout metadata and backs up its resolved files", () => {
        fixture(
            "hero",
            { category: "layout", scss: "_hero-custom.scss" },
            ".l-hero {display:grid;}",
            '<section class="l-hero">Hero</section>',
        );
        expect(installComponent("hero", {}, paths).success).toBe(true);
        expect(read(paths.clientLayoutDir, "_hero-custom.scss")).toContain(
            ".l-hero",
        );
        expect(deleteWorkbenchComponent("hero", {}, paths).success).toBe(true);
        expect(read(backupFiles()[0], "_hero-custom.scss")).toContain(
            ".l-hero",
        );
    });

    it("rejects missing explicit dependencies and rolls back completed dependencies", () => {
        fixture("alpha", { dependencies: ["beta", "missing"] });
        fixture("beta");
        const result = installComponent("alpha", {}, paths);
        expect(result.success).toBe(false);
        expect(result.message).toContain("Missing dependency");
        expect(fs.existsSync(join(paths.clientScssDir, "_beta.scss"))).toBe(
            false,
        );
        expect(fs.existsSync(join(paths.clientScssDir, "_index.scss"))).toBe(
            false,
        );
    });

    it("detects circular dependencies without overflowing the stack", () => {
        fixture("alpha", { dependencies: ["beta"] });
        fixture("beta", { dependencies: ["alpha"] });
        const result = installComponent("alpha", {}, paths);
        expect(result.success).toBe(false);
        expect(result.message).toContain("Circular dependency");
    });

    it("allows optional inferred dependencies to be absent with a warning", () => {
        fixture(
            "alpha",
            {},
            ".c-alpha {color:red;}",
            '<section class="c-alpha"><a class="c-btn">Go</a></section>',
        );
        const result = installComponent("alpha", {}, paths);
        expect(result.success).toBe(true);
        expect(result.warnings.join(" ")).toContain("btns");
    });

    it("rejects nonexistent variants instead of creating placeholder SCSS", () => {
        expect(
            installVariant("missing", { classStr: "c-missing" }, paths).success,
        ).toBe(false);
        expect(fs.existsSync(join(paths.clientScssDir, "_missing.scss"))).toBe(
            false,
        );
    });

    it("preserves shared client SCSS when removing one component", () => {
        fixture("alpha", { scss: "_shared.scss" });
        fixture("beta", { scss: "_shared.scss" });
        write(
            paths.clientScssDir,
            "_shared.scss",
            ".c-alpha {color:red;} .c-beta {color:blue;}",
        );
        write(
            paths.clientComponentsDir,
            "_alpha.ejs",
            '<div class="c-alpha">A</div>',
        );
        expect(removeComponent("alpha", { force: true }, paths).success).toBe(
            true,
        );
        expect(read(paths.clientScssDir, "_shared.scss")).toContain("c-beta");
    });

    it("rejects unknown classes and modifiers within an existing component", () => {
        fixture("alpha");
        expect(
            installVariant("alpha", { classStr: "c-other" }, paths).success,
        ).toBe(false);
        expect(
            installVariant(
                "alpha",
                { classStr: "c-alpha c-alpha--missing" },
                paths,
            ).success,
        ).toBe(false);
        expect(fs.existsSync(join(paths.clientScssDir, "_alpha.scss"))).toBe(
            false,
        );
    });

    it("supports JS-only components and variants without creating empty CSS", () => {
        fixture("alpha", {}, null);
        write(paths.wbJsDir, "alpha.js", 'console.log("alpha");');
        expect(
            installVariant(
                "alpha",
                { classStr: "c-alpha", targetJsFile: "company.js" },
                paths,
            ).success,
        ).toBe(true);
        expect(
            read(join(paths.root, "src/pages/assets/js"), "company.js"),
        ).toContain('console.log("alpha")');
        expect(fs.existsSync(join(paths.clientScssDir, "_alpha.scss"))).toBe(
            false,
        );
        expect(getRegistry(paths)[0].isInstalled).toBe(true);
    });

    it("protects custom SCSS and JS on reimport, while explicit force remains available", () => {
        fixture("alpha");
        write(paths.wbJsDir, "alpha.js", 'console.log("original");');
        expect(installComponent("alpha", {}, paths).success).toBe(true);
        write(paths.clientScssDir, "_alpha.scss", ".c-alpha { color: blue; }");
        expect(installComponent("alpha", {}, paths).conflict).toBe(true);
        expect(read(paths.clientScssDir, "_alpha.scss")).toContain("blue");
        expect(installComponent("alpha", { force: true }, paths).success).toBe(
            true,
        );
        write(paths.clientJsDir, "alpha.js", 'console.log("custom");');
        expect(installComponent("alpha", {}, paths).conflict).toBe(true);
        expect(read(paths.clientJsDir, "alpha.js")).toContain("custom");
    });

    it("does not duplicate standalone JavaScript on repeated import", () => {
        fixture("alpha");
        write(paths.wbJsDir, "alpha.js", 'console.log("alpha");');
        expect(installComponent("alpha", {}, paths).success).toBe(true);
        expect(installComponent("alpha", {}, paths).success).toBe(true);
        expect(
            read(paths.clientJsDir, "alpha.js").match(/console.log/g),
        ).toHaveLength(1);
    });

    it("reports a real registry update from 1.9.0 to 1.10.0", () => {
        fixture("alpha", { version: "1.10.0" });
        write(
            paths.clientComponentsDir,
            "_alpha.ejs",
            '<!--\n---\nversion: "1.9.0"\n---\n-->\n<section>Installed</section>',
        );
        write(paths.clientScssDir, "_alpha.scss", ".c-alpha {color:red;}");
        expect(getRegistry(paths)[0].hasUpdate).toBe(true);
    });

    it("preserves customized shared JavaScript on variant reimport", () => {
        fixture("alpha");
        write(paths.wbJsDir, "alpha.js", 'console.log("original");');
        const target = join(paths.root, "src/pages/assets/js");
        fs.mkdirSync(target, { recursive: true });
        const custom = '/* [Component: alpha] */\nconsole.log("custom");';
        write(target, "common.js", custom);
        const result = installVariant(
            "alpha",
            { classStr: "c-alpha", targetJsFile: "common.js" },
            paths,
        );
        expect(result.conflict).toBe(true);
        expect(read(target, "common.js")).toBe(custom);
        expect(fs.existsSync(join(paths.clientScssDir, "_alpha.scss"))).toBe(
            false,
        );
    });

    it("keeps alias module markers consistent with the installed component name", () => {
        fixture("alpha");
        write(
            paths.wbJsDir,
            "alpha.js",
            '/* [Component: alpha] */\nconsole.log("alpha");',
        );
        const result = installComponent(
            "alpha",
            { as: "custom", targetJsFile: "common.js", includeEjs: true },
            paths,
        );
        expect(result.success).toBe(true);
        expect(
            read(join(paths.root, "src/pages/assets/js"), "common.js"),
        ).toContain("[Component: custom]");
        expect(
            saveComponent("custom", { as: "saved", force: true }, paths)
                .success,
        ).toBe(true);
        expect(read(paths.wbJsDir, "saved.js")).toContain("[Component: saved]");
    });

    it("keeps the original snapshot when a transaction changes a new file repeatedly", () => {
        const file = join(paths.clientScssDir, "_new.scss");
        const tx = new InstallTransaction();
        tx.recordCreated(file);
        write(paths.clientScssDir, "_new.scss", "first");
        tx.recordModified(file, "first");
        write(paths.clientScssDir, "_new.scss", "second");
        tx.rollback();
        expect(fs.existsSync(file)).toBe(false);
    });

    it.each([
        ["1.10.0", "1.9.0", 1],
        ["1.0.0", "1.0.0-beta", 1],
        ["1.0.0-beta.10", "1.0.0-beta.2", 1],
        ["1.0.0+build2", "1.0.0+build1", 0],
    ])("compares versions %s and %s", (a, b, expected) => {
        expect(compareComponentVersions(a, b)).toBe(expected);
    });
});
