/**
 * Google Apps Script - イベント招待状 出欠回答受付
 * 
 * このスクリプトをGoogleスプレッドシートのApps Scriptエディタに貼り付けて
 * Webアプリとしてデプロイしてください。
 * 詳細な手順は docs/gas-setup.md を参照。
 */

/**
 * POSTリクエストを受け取り、スプレッドシートに書き込む
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // ヘッダーが未設定の場合に設定
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['タイムスタンプ', '名前', '出欠', 'メッセージ']);
      // ヘッダー行をスタイリング
      var headerRange = sheet.getRange(1, 1, 1, 4);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4a90d9');
      headerRange.setFontColor('#ffffff');
    }
    
    // データを追加
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.name || '',
      data.attendance || '',
      data.message || ''
    ]);
    
    // 列幅を自動調整
    sheet.autoResizeColumns(1, 4);
    
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
