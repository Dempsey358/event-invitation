/**
 * Google Apps Script - イベント招待状 出欠回答受付
 * 
 * このスクリプトをGoogleスプレッドシートのApps Scriptエディタに貼り付けて
 * Webアプリとしてデプロイしてください。
 * 詳細な手順は docs/gas-setup.md を参照。
 */

/** 候補日リスト（config.jsonのcandidateDatesと合わせる） */
var CANDIDATE_DATES = ['2026-04-22', '2026-04-24', '2026-05-01', '2026-05-08'];

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
 * 候補日を「4/3(金)」形式のヘッダーに変換
 */
function formatDateHeader(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  var weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  return (d.getMonth() + 1) + '/' + d.getDate() + '(' + weekDays[d.getDay()] + ')';
}

/**
 * ヘッダー行を設定する
 */
function setupHeader(sheet) {
  var headers = ['タイムスタンプ', '名前', '出欠'];
  for (var i = 0; i < CANDIDATE_DATES.length; i++) {
    headers.push(formatDateHeader(CANDIDATE_DATES[i]));
  }
  headers.push('メッセージ');
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // ヘッダー行をスタイリング
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a90d9');
  headerRange.setFontColor('#ffffff');
  headerRange.setHorizontalAlignment('center');
  
  // 日付列の幅を調整
  for (var i = 0; i < CANDIDATE_DATES.length; i++) {
    sheet.setColumnWidth(4 + i, 80);
  }
  
  return headers.length;
}

/**
 * 集計行を更新する
 */
function updateSummary(sheet, totalColumns) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  // 既存の集計行を探す
  var summaryRow = -1;
  var col1Values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < col1Values.length; i++) {
    if (col1Values[i][0] === '【集計】') {
      summaryRow = i + 2;
      break;
    }
  }
  
  // 集計行がなければ追加
  if (summaryRow === -1) {
    summaryRow = lastRow + 2; // 1行空けて集計
    sheet.getRange(summaryRow, 1).setValue('【集計】');
  }
  
  // 参加人数
  var dataStartRow = 2;
  var dataEndRow = summaryRow - 2; // 空行の前まで
  
  sheet.getRange(summaryRow, 2).setValue('参加者数');
  
  // 出欠の集計（参加人数）
  var attendCol = String.fromCharCode(66 + 1); // C列
  sheet.getRange(summaryRow, 3).setFormula(
    '=COUNTIF(' + attendCol + dataStartRow + ':' + attendCol + dataEndRow + ',"参加")'
  );
  
  // 各候補日の○の数をカウント
  for (var i = 0; i < CANDIDATE_DATES.length; i++) {
    var col = String.fromCharCode(68 + i); // D, E, F, G...
    sheet.getRange(summaryRow, 4 + i).setFormula(
      '=COUNTIF(' + col + dataStartRow + ':' + col + dataEndRow + ',"○")'
    );
  }
  
  // 集計行をスタイリング
  var summaryRange = sheet.getRange(summaryRow, 1, 1, totalColumns);
  summaryRange.setFontWeight('bold');
  summaryRange.setBackground('#fff3cd');
  summaryRange.setHorizontalAlignment('center');
}

/**
 * POSTリクエストを受け取り、スプレッドシートに書き込む
 * 同じ名前（正規化後）が既にある場合は上書き更新
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var totalColumns = 3 + CANDIDATE_DATES.length + 1; // タイムスタンプ,名前,出欠 + 日付列 + メッセージ
    
    // ヘッダーが未設定の場合に設定
    if (sheet.getLastRow() === 0) {
      setupHeader(sheet);
    }
    
    var incomingName = data.name || '';
    var normalizedIncoming = normalizeName(incomingName);
    
    // 各候補日に対して○/空白を設定
    var preferredSet = {};
    if (data.preferredDates && Array.isArray(data.preferredDates)) {
      for (var i = 0; i < data.preferredDates.length; i++) {
        preferredSet[data.preferredDates[i]] = true;
      }
    }
    
    var newRow = [
      data.timestamp || new Date().toISOString(),
      incomingName,
      data.attendance || ''
    ];
    
    // 候補日ごとに○または空白
    for (var i = 0; i < CANDIDATE_DATES.length; i++) {
      newRow.push(preferredSet[CANDIDATE_DATES[i]] ? '○' : '');
    }
    
    newRow.push(data.message || '');
    
    // 既存の行を検索（名前の正規化比較、集計行は除外）
    var lastRow = sheet.getLastRow();
    var existingRow = -1;
    
    if (lastRow > 1) {
      var nameColumn = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
      var col1Values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < nameColumn.length; i++) {
        if (col1Values[i][0] === '【集計】' || col1Values[i][0] === '') continue;
        if (normalizeName(nameColumn[i][0]) === normalizedIncoming) {
          existingRow = i + 2;
          break;
        }
      }
    }
    
    if (existingRow > 0) {
      // 既存の行を上書き
      sheet.getRange(existingRow, 1, 1, totalColumns).setValues([newRow]);
    } else {
      // 集計行の前に挿入（集計行がある場合）
      var summaryRow = -1;
      if (lastRow > 1) {
        var col1Check = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < col1Check.length; i++) {
          if (col1Check[i][0] === '【集計】') {
            summaryRow = i + 2;
            break;
          }
        }
      }
      
      if (summaryRow > 0) {
        // 集計行の2行前（空行の前）に挿入
        sheet.insertRowBefore(summaryRow - 1);
        sheet.getRange(summaryRow - 1, 1, 1, totalColumns).setValues([newRow]);
      } else {
        sheet.appendRow(newRow);
      }
    }
    
    // 日付列の中央揃え
    var dataLastRow = sheet.getLastRow();
    if (dataLastRow > 1) {
      sheet.getRange(2, 4, dataLastRow - 1, CANDIDATE_DATES.length).setHorizontalAlignment('center');
    }
    
    // 集計行を更新
    updateSummary(sheet, totalColumns);
    
    // 列幅を自動調整（名前・メッセージ列）
    sheet.autoResizeColumn(1);
    sheet.autoResizeColumn(2);
    sheet.autoResizeColumn(totalColumns);
    
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
