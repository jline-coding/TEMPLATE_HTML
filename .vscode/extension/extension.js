/**
 * JLINE Workbench Tools Extension
 * Contributes Right-Click Context Menu & Shortcuts:
 * - '⚡ Export Component to Workbench' (Alt+W)
 * - '⚡ Import Component from Workbench' (Alt+I)
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

function activate(context) {
  // 1. EXPORT TO WORKBENCH (Alt+W)
  let exportDisposable = vscode.commands.registerCommand('jline.exportToWorkbench', async function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Không có file nào đang mở trong editor!');
      return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const selectedText = document.getText(selection);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('Vui lòng mở workspace thư mục dự án!');
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const scriptPath = path.join(rootPath, 'scripts', 'export-selection.js');

    if (!fs.existsSync(scriptPath)) {
      vscode.window.showErrorMessage(`Không tìm thấy script export: ${scriptPath}`);
      return;
    }

    const vscodeDir = path.join(rootPath, '.vscode');
    if (!fs.existsSync(vscodeDir)) {
      try { fs.mkdirSync(vscodeDir, { recursive: true }); } catch (e) {}
    }
    const tempFile = path.join(vscodeDir, '.temp-selection.html');

    const filePath = document.uri.fsPath;
    const lineNumber = selection.active.line + 1;

    if (selectedText && selectedText.trim().length > 0) {
      fs.writeFileSync(tempFile, selectedText, 'utf8');
    } else {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) {}
      }
    }

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "⚡ Đang xuất component vào Workbench Showroom...",
      cancellable: false
    }, async () => {
      return new Promise((resolve) => {
        const cmd = `node "${scriptPath}" "${filePath}" "${lineNumber}"`;
        exec(cmd, { cwd: rootPath }, (error, stdout, stderr) => {
          if (fs.existsSync(tempFile)) {
            try { fs.unlinkSync(tempFile); } catch (e) {}
          }

          if (error) {
            vscode.window.showErrorMessage(`Lỗi xuất component: ${stderr || error.message}`);
            resolve();
            return;
          }

          const match = stdout.match(/ĐÃ ĐƯA COMPONENT "([^"]+)" VÀO WORKBENCH/i);
          if (match) {
            const compName = match[1].toLowerCase();
            const action = "Mở Showroom (Browser)";
            vscode.window.showInformationMessage(
              `✓ Đã đưa component "${compName}" vào Workbench Showroom thành công!`,
              action
            ).then(selected => {
              if (selected === action) {
                vscode.env.openExternal(vscode.Uri.parse(`http://localhost:8686/__workbench/#sec-${compName}`));
              }
            });
          } else if (stdout.includes('Không tìm thấy')) {
            vscode.window.showWarningMessage('Không tìm thấy khối mã HTML component hợp lệ (c-* hoặc l-*). Vui lòng quét khối lại!');
          } else {
            vscode.window.showInformationMessage(`Hoàn tất: ${stdout.trim().split('\n').pop()}`);
          }
          resolve();
        });
      });
    });
  });

  // 2. IMPORT FROM WORKBENCH (Alt+I)
  let importDisposable = vscode.commands.registerCommand('jline.importFromWorkbench', async function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Không có file nào đang mở trong editor!');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('Vui lòng mở workspace thư mục dự án!');
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const snippetsPath = path.join(rootPath, '.vscode', 'jline-components.code-snippets');
    const wbCompDir = path.join(rootPath, 'workbench', 'components');

    let items = [];
    if (fs.existsSync(snippetsPath)) {
      try {
        const snippets = JSON.parse(fs.readFileSync(snippetsPath, 'utf8'));
        items = Object.keys(snippets).map(key => {
          const item = snippets[key];
          return {
            label: item.prefix || key,
            description: key,
            detail: item.description || '',
            body: Array.isArray(item.body) ? item.body.join('\n') : item.body
          };
        });
      } catch (e) {}
    }

    if (items.length === 0 && fs.existsSync(wbCompDir)) {
      try {
        const files = fs.readdirSync(wbCompDir).filter(f => f.endsWith('.ejs'));
        items = files.map(f => {
          const name = f.replace(/^_/, '').replace(/\.ejs$/, '');
          return {
            label: `c-${name}`,
            description: f,
            detail: `Component ${name}`,
            body: fs.readFileSync(path.join(wbCompDir, f), 'utf8')
          };
        });
      } catch (e) {}
    }

    if (items.length === 0) {
      vscode.window.showWarningMessage('Chưa tìm thấy component nào trong Workbench showroom hoặc file snippets!');
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '🔍 Chọn component từ Workbench để chèn vào vị trí con trỏ (hoặc gõ tìm kiếm)...',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await editor.insertSnippet(new vscode.SnippetString(selected.body));
      vscode.window.showInformationMessage(`✓ Đã chèn component "${selected.label}" vào code!`);
    }
  });

  context.subscriptions.push(exportDisposable);
  context.subscriptions.push(importDisposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
