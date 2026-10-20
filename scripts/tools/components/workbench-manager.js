import { existsSync, readFileSync } from "fs";
import { resolve, basename, relative } from "path";
import { createHash } from "crypto";
import {
    normalizeName,
    formatComponentMetadata,
    parseComponentMetadata,
} from "./metadata.js";
import {
    getDefaultPaths,
    getWorkbenchScssDirForCategory,
    resolveComponentFiles,
} from "./paths.js";
import { resolveSafePath, isValidComponentName } from "../safety.js";
import { createSnapshotBackup } from "./backup.js";
import { updateWorkbenchScss } from "./installer.js";
import { InstallTransaction } from "./transaction.js";
import {
    getRegistry,
    getWorkbenchRevision,
    sliceJsForComponent,
    getComponentJsRange,
    removeComponentJs,
} from "./registry.js";
import {
    parseEjsComponentCards,
    removeVariantFromEjs,
    removeVariantFromScss,
} from "./variants.js";

function failure(error, tx) {
    try {
        tx.rollback();
    } catch (rollbackError) {
        return {
            success: false,
            rolledBack: false,
            message: `${error.message}; ${rollbackError.message}`,
        };
    }
    return {
        success: false,
        rolledBack: true,
        conflict: error.conflict === true,
        message: error.message,
    };
}
function conflict(message) {
    const error = new Error(message);
    error.conflict = true;
    throw error;
}
function label(file, paths) {
    return relative(paths.root, file).replace(/\\/g, "/");
}
function findComponent(name, paths) {
    const norm = normalizeName(name);
    return getRegistry(paths).find(
        (item) =>
            item.name === norm ||
            item.name === norm + "s" ||
            item.name.replace(/s$/, "") === norm,
    );
}

// Plan once, snapshot once and commit the entire library deletion together.
export function deleteAllWorkbenchComponents(
    options = {},
    paths = getDefaultPaths(),
) {
    const tx = new InstallTransaction();
    try {
        const registry = getRegistry(paths);
        if (
            options.revision &&
            options.revision !== getWorkbenchRevision(paths, registry)
        )
            conflict(
                "Thư viện đã thay đổi. Hãy tải lại Workbench trước khi xóa tất cả.",
            );
        if (!registry.length)
            return {
                success: true,
                deletedCount: 0,
                deletedFiles: [],
                warnings: [],
                message: "Workbench đang trống.",
            };
        const sources = registry.map((item) =>
            resolveComponentFiles(item.name, paths),
        );
        const removals = new Set(),
            indexes = new Map(),
            jsGroups = new Map();
        const writes = new Map(),
            warnings = [];
        const coreContainer = resolve(paths.wbLayoutDir, "_container.scss");
        for (const source of sources) {
            if (source.ejsPath) removals.add(source.ejsPath);
            // The showroom always imports this base layout, even when empty.
            if (
                source.scssPath &&
                source.scssPath.toLowerCase() !== coreContainer.toLowerCase()
            ) {
                removals.add(source.scssPath);
                const index = resolve(source.scssPath, "..", "_index.scss");
                if (!indexes.has(index)) indexes.set(index, new Set());
                indexes
                    .get(index)
                    .add(basename(source.scssPath, ".scss").replace(/^_/, ""));
            }
            if (source.jsPath) {
                if (!jsGroups.has(source.jsPath))
                    jsGroups.set(source.jsPath, []);
                jsGroups.get(source.jsPath).push(source.name);
            }
        }
        for (const [file, names] of jsGroups) {
            const original = readFileSync(file, "utf8");
            const dedicated =
                names.length === 1 &&
                !["common.js", "top.js"].includes(basename(file)) &&
                [
                    names[0] + ".js",
                    names[0] + "s.js",
                    "_" + names[0] + ".js",
                ].includes(basename(file));
            // A uniquely owned file may contain several variant module markers.
            if (dedicated) {
                removals.add(file);
                continue;
            }
            let remaining = original;
            for (const name of names) {
                const next = removeComponentJs(remaining, name);
                if (next === null)
                    warnings.push(
                        `Giữ phần JS không xác định trong ${basename(file)} (${name}).`,
                    );
                else remaining = next;
            }
            if (remaining !== original) writes.set(file, remaining);
        }
        for (const [index, modules] of indexes) {
            if (!existsSync(index)) continue;
            let content = readFileSync(index, "utf8");
            for (const module of modules) {
                const escaped = module.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                content = content.replace(
                    new RegExp(
                        `@(?:use|forward)\\s+["'](?:\\./)?_?${escaped}(?:\\.scss)?["'](?:[^;"']|"[^"]*"|'[^']*')*;[ \\t]*\\r?\\n?`,
                        "g",
                    ),
                    "",
                );
            }
            writes.set(index, content);
        }
        const backupDir = createSnapshotBackup(
            "all-components",
            "before_workbench_clear",
            paths,
            [...removals, ...writes.keys(), ...jsGroups.keys()],
        );
        for (const [file, content] of writes) tx.write(file, content);
        for (const file of removals) tx.remove(file);
        tx.commit();
        return {
            success: true,
            deletedCount: registry.length,
            deletedFiles: [...removals].map((file) => label(file, paths)),
            backupDir: label(backupDir, paths),
            warnings,
            message: `Đã xóa ${registry.length} module khỏi Workbench. Các component trong site được giữ nguyên.${warnings.length ? " " + warnings.join(" ") : ""}`,
        };
    } catch (error) {
        return failure(error, tx);
    }
}

export function saveComponent(
    srcName,
    options = {},
    paths = getDefaultPaths(),
) {
    const tx = new InstallTransaction();
    try {
        const source = resolveComponentFiles(srcName, paths, "client");
        const targetName = options.as ? normalizeName(options.as) : source.name;
        if (!isValidComponentName(targetName))
            throw new Error("Tên component không hợp lệ");
        if (!source.ejsPath && !source.scssPath && !source.jsPath)
            throw new Error(`Không tìm thấy component "${srcName}" trong src`);
        const scssDir = getWorkbenchScssDirForCategory(source.category, paths);
        const writes = [];
        const destScss = source.scssPath
            ? resolveSafePath(scssDir, `_${targetName}.scss`, "save SCSS")
            : null;
        const destJs = source.jsPath
            ? resolveSafePath(paths.wbJsDir, `${targetName}.js`, "save JS")
            : null;
        if (source.ejsPath) {
            let content = readFileSync(source.ejsPath, "utf8");
            if (Object.keys(source.meta).length) {
                const meta = { ...source.meta };
                if (destScss && meta.scss) meta.scss = basename(destScss);
                if (destJs && meta.js) meta.js = basename(destJs);
                content = formatComponentMetadata(
                    meta,
                    parseComponentMetadata(content).content,
                );
            }
            writes.push([
                resolveSafePath(
                    paths.wbComponentsDir,
                    `_${targetName}.ejs`,
                    "save EJS",
                ),
                content,
            ]);
        }
        if (destScss)
            writes.push([destScss, readFileSync(source.scssPath, "utf8")]);
        if (destJs) {
            const full = readFileSync(source.jsPath, "utf8");
            if (
                ["common.js", "top.js"].includes(basename(source.jsPath)) &&
                !getComponentJsRange(full, source.name)
            )
                conflict("Không xác định được module JS trong file dùng chung");
            const module = sliceJsForComponent(full, source.name);
            writes.push([
                destJs,
                targetName === source.name
                    ? module
                    : module.replace(
                          /(\[Component(?:\s*Module)?:\s*)[\w-]+(\])/i,
                          `$1${targetName}$2`,
                      ),
            ]);
        }
        for (const [file, content] of writes) {
            if (
                !options.force &&
                existsSync(file) &&
                readFileSync(file, "utf8").trim() !== content.trim()
            )
                conflict(
                    `File ${label(file, paths)} đã có nội dung khác. Dùng force hoặc lưu với tên mới.`,
                );
        }
        const index = resolve(scssDir, "_index.scss");
        createSnapshotBackup(targetName, "sync_from_site", paths, [
            ...writes.map(([file]) => file),
            index,
        ]);
        for (const [file, content] of writes) tx.write(file, content);
        if (destScss) {
            tx.capture(index);
            updateWorkbenchScss(targetName, "add", source.category, paths);
        }
        tx.commit();
        return {
            success: true,
            name: targetName,
            savedFiles: writes.map(([file]) => label(file, paths)),
            message: `Đã lưu component "${targetName}" vào Workbench.`,
        };
    } catch (error) {
        return failure(error, tx);
    }
}

export function deleteWorkbenchComponent(
    targetName,
    options = {},
    paths = getDefaultPaths(),
) {
    const tx = new InstallTransaction();
    try {
        const registry = getRegistry(paths);
        const found = findComponent(targetName, paths);
        if (!found)
            throw new Error(
                `Component "${targetName}" không tồn tại trong Workbench`,
            );
        const source = resolveComponentFiles(found.name, paths);
        const scssDir = source.scssPath
            ? resolve(source.scssPath, "..")
            : getWorkbenchScssDirForCategory(source.category, paths);
        const index = resolve(scssDir, "_index.scss");
        createSnapshotBackup(source.name, "before_workbench_delete", paths, [
            source.ejsPath,
            source.scssPath,
            source.jsPath,
            index,
        ]);
        const deletedFiles = [],
            warnings = [];
        if (source.ejsPath) {
            tx.remove(source.ejsPath);
            deletedFiles.push(label(source.ejsPath, paths));
        }
        const scssShared =
            source.scssPath &&
            registry.some(
                (item) =>
                    item.name !== found.name &&
                    resolveComponentFiles(item.name, paths).scssPath ===
                        source.scssPath,
            );
        if (source.scssPath && !scssShared) {
            tx.remove(source.scssPath);
            deletedFiles.push(label(source.scssPath, paths));
            tx.capture(index);
            updateWorkbenchScss(
                basename(source.scssPath, ".scss").replace(/^_/, ""),
                "remove",
                source.category,
                paths,
            );
        }
        if (source.jsPath) {
            const full = readFileSync(source.jsPath, "utf8");
            const shared =
                ["common.js", "top.js"].includes(basename(source.jsPath)) ||
                registry.some(
                    (item) =>
                        item.name !== found.name &&
                        resolveComponentFiles(item.name, paths).jsPath ===
                            source.jsPath,
                );
            if (shared) {
                const remaining = removeComponentJs(full, source.name);
                if (remaining !== null) tx.write(source.jsPath, remaining);
                else
                    warnings.push(
                        "Giữ nguyên JS dùng chung vì không có marker xác định module.",
                    );
            } else {
                tx.remove(source.jsPath);
                deletedFiles.push(label(source.jsPath, paths));
            }
        }
        tx.commit();
        return {
            success: true,
            name: source.name,
            deletedFiles,
            warnings,
            message: `Đã xóa component "${source.name}" khỏi Workbench.${warnings.length ? " " + warnings.join(" ") : ""}`,
        };
    } catch (error) {
        return failure(error, tx);
    }
}

export function deleteWorkbenchVariant(
    { component, classStr, cardIndex, commentTitle, revision },
    paths = getDefaultPaths(),
) {
    const tx = new InstallTransaction();
    try {
        const found = findComponent(component, paths);
        if (!found)
            throw new Error(
                `Component "${component}" không tồn tại trong Workbench`,
            );
        const source = resolveComponentFiles(found.name, paths);
        const raw = readFileSync(source.ejsPath, "utf8");
        if (
            revision &&
            revision !== createHash("sha256").update(raw).digest("hex")
        )
            conflict(
                "Component đã thay đổi. Hãy tải lại Workbench trước khi xóa.",
            );
        const remaining = removeVariantFromEjs(raw, {
            classStr,
            cardIndex,
            commentTitle,
        });
        if (remaining === raw)
            conflict(
                "Variant không tồn tại hoặc dữ liệu đã thay đổi. Hãy tải lại Workbench.",
            );
        createSnapshotBackup(source.name, "before_variant_delete", paths, [
            source.ejsPath,
            source.scssPath,
        ]);
        tx.write(source.ejsPath, remaining);
        const modifiedFiles = [label(source.ejsPath, paths)];
        if (source.scssPath) {
            // A shared stylesheet may also serve EJS from another component group.
            const otherEjs = getRegistry(paths)
                .filter((item) => item.name !== source.name)
                .filter(
                    (item) =>
                        resolveComponentFiles(item.name, paths).scssPath ===
                        source.scssPath,
                )
                .map((item) => item.wbEjsContent)
                .join("\n");
            const before = readFileSync(source.scssPath, "utf8");
            const after = removeVariantFromScss(
                before,
                remaining + "\n" + otherEjs,
                classStr,
            );
            if (before !== after) {
                tx.write(source.scssPath, after);
                modifiedFiles.push(label(source.scssPath, paths));
            }
        }
        tx.commit();
        return {
            success: true,
            component: source.name,
            remainingCards: parseEjsComponentCards(remaining).length,
            modifiedFiles,
            message: "Đã xóa variant khỏi Workbench.",
        };
    } catch (error) {
        return failure(error, tx);
    }
}
