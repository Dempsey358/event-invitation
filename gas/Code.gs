/**
 * Google Apps Script - イベント招待状 出欠回答受付
 * 
 * このスクリプトをGoogleスプレッドシートのApps Scriptエディタに貼り付けて
 * Webアプリとしてデプロイしてください。
 * 詳細な手順は docs/gas-setup.md を参照。
 */

/**
 * 名前を正規化する（半角/全角、スペースを統一）
 */
function normalizeName(name) {
  if (!name) return '';
  // 全角英数字→半角
  var result = name.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
    return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
  });
  // 全角スペース→半角スペース、その後すべてのスペースを除去
  result = result.replace(/[\s　]+/g, '');
  // 小文字化（英字の場合の比較用）
  result = result.toLowerCase();
  return result;
}

/**
 * POSTリクエストを受け取り、スプレッドシートに書き込む
 * 同じ名前（正規化後）が既にある場合は上書き更新
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // ヘッダーが未設定の場合に設定
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['タイムスタンプ', '名前', '出欠', '希望日', 'メッセージ']);
      // ヘッダー行をスタイリング
      var headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a90d9');
      headerRange.setFontColor('#ffffff');
    }
    
    var incomingName = data.name || '';
    var normalizedIncoming = normalizeName(incomingName);
    
    // 希望日を配列からカンマ区切り文字列に変換
    var preferredDates = '';
    if (data.preferredDates && Array.isArray(data.preferredDates)) {
      preferredDates = data.preferredDates.join(', ');
    }
    
    var newRow = [
      data.timestamp || new Date().toISOString(),
      incomingName,
      data.attendance || '',
      preferredDates,
      data.message || ''
    ];
    
    // 既存の行を検索（名前の正規化比較）
    var lastRow = sheet.getLastRow();
    var existingRow = -1;
    
    if (lastRow > 1) {
      var nameColumn = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      for (var i = 0; i < nameColumn.length; i++) {
        if (normalizeName(nameColumn[i][0]) === normalizedIncoming) {
          existingRow = i + 2; // +2: 1-indexed + header row
          break;
        }
      }
    }
    
    if (existingRow > 0) {
      // 既存の行を上書き
      sheet.getRange(existingRow, 1, 1, 5).setValues([newRow]);
    } else {
      // 新しい行を追加
      sheet.appendRow(newRow);
    }
    
    // 列幅を自動調整
    sheet.autoResizeColumns(1, 5);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエスト（動作確認用）
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'RSVP API is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}
