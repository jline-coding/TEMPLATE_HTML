import {
    existsSync,
    readFileSync,
    writeFileSync,
    unlinkSync,
    mkdirSync,
} from "fs";
import { dirname } from "path";

// Keep the first state of each file, including files written by dependencies.
export class InstallTransaction {
    constructor() {
        this.originals = new Map();
        this.activeComponents = new Set();
        this.completedComponents = new Set();
        this.committed = false;
    }
    recordCreated(file) {
        if (!this.originals.has(file)) this.originals.set(file, null);
    }
    recordModified(file, content) {
        if (!this.originals.has(file)) this.originals.set(file, content);
    }
    capture(file) {
        if (file && !this.originals.has(file)) {
            this.originals.set(
                file,
                existsSync(file) ? readFileSync(file) : null,
            );
        }
    }
    write(file, content) {
        this.capture(file);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
    remove(file) {
        this.capture(file);
        if (existsSync(file)) unlinkSync(file);
    }
    rollback() {
        if (this.committed) return;
        const failures = [];
        for (const [file, content] of [...this.originals].reverse()) {
            try {
                if (content === null) {
                    if (existsSync(file)) unlinkSync(file);
                } else {
                    mkdirSync(dirname(file), { recursive: true });
                    writeFileSync(file, content);
                }
            } catch (error) {
                failures.push(`${file}: ${error.message}`);
            }
        }
        if (failures.length)
            throw new Error(`Rollback incomplete: ${failures.join("; ")}`);
    }
    commit() {
        this.committed = true;
    }
}
