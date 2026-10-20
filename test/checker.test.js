const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { compare } = require('../src/compare');
const { readList } = require('../src/import');
const { suggestSelection } = require('../src/import');
const { overview } = require('../src/overview');
const { markedWorkbook } = require('../src/marked-workbook');
test('blocked terminal containers override delivered and export once in deep red', async () => {
  const vessel = { rows: [['Cont. No','Booking No'],['MSCU1234567','BOOK1'],['MSCU1234567','BOOK1'],['ABCD7654321','BOOK2'],['','BOOK3']] };
  const quay = [['Containers','Container','MSCU1234567','',' no '],['Containers','Container','mscu-1234567','',' YES '],['Containers','Container','ABCD7654321','','No']];
  const data = compare(vessel.rows.slice(1),0,quay,2,4);
  assert.equal(data.blockedCount,1);
  assert.equal(data.results.find(row=>row.container==='MSCU1234567').status,'Blocked');
  assert.equal(data.results.find(row=>row.container==='ABCD7654321').status,'Delivered');
  assert.equal(compare(vessel.rows.slice(1),0,quay,2,-1).blockedCount,0);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await markedWorkbook(vessel,{column:0,start:2},quay,2,4).xlsx.writeBuffer());
  for (const number of [2]) {
    assert.equal(workbook.worksheets[0].getCell(`C${number}`).value,'Blocked');
    assert.equal(workbook.worksheets[0].getCell(`A${number}`).fill.fgColor.argb,'FF8B1E2D');
    assert.equal(workbook.worksheets[0].getCell(`A${number}`).font.color.argb,'FFFFFFFF');
  }
  assert.equal(workbook.worksheets[0].getCell('C3').value,'Delivered');
});
test('mail draft contains a valid marked Excel attachment and cannot inject headers', async () => {
  const { createEmailDraft } = require('../src/email-draft');
  const bytes = await markedWorkbook({rows:[['Cont. No','Booking No'],['MSCU1234567','BOOK1']]},{column:0,start:2},[['MSCU1234567']],0,-1).xlsx.writeBuffer();
  const eml = createEmailDraft({workbookBytes:bytes,vesselName:'Vessel Å\r\nBcc: unwanted@example.test',summary:{bookedTotal:1,bookedTeu:2,onTerminal:1,terminalTeu:2,outstanding:0},createdAt:new Date('2026-10-15T12:34:00Z')});
  assert.ok(eml.startsWith('X-Unsent: 1\r\n'));
  const subject = eml.match(/Subject: ([\s\S]*?)\r\nContent-Type:/)[1].replace(/=\?UTF-8\?B\?([^?]+)\?=/g,(_,text)=>Buffer.from(text,'base64').toString('utf8')).replace(/\r\n /g,'');
  assert.match(subject,/15\/10\/2026, 14:34 CEST/);
  const body = Buffer.from(eml.split('Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n\r\n')[0].replace(/\r\n/g,''),'base64').toString('utf8');
  assert.match(body,/Total booked containers: 1\r\nTotal TEU booked: 2/);
  assert.match(body,/Containers on terminal: 1\r\nTotal TEU on terminal: 2/);
  assert.match(body,/Containers not on terminal: 0/);assert.ok(!body.includes('Numbered containers outstanding'));

  assert.ok(!eml.includes('\r\nBcc:'));
  assert.match(eml,/filename="marked-loading-list.xlsx"/);
  const attachment = eml.split('Content-Disposition: attachment; filename="marked-loading-list.xlsx"')[1].split('\r\n\r\n')[1].split('\r\n\r\n')[0];
  const decoded = Buffer.from(attachment.replace(/\r\n/g,''),'base64');
  assert.deepEqual(decoded,bytes);
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(decoded);
  assert.equal(workbook.worksheets[0].getCell('C2').value,'Delivered');
});
test('marked Excel removes unnecessary source columns while retaining aligned values and delivery status', async () => {
  const removed=['Seal No','POL','POD','BL NO','Status','Weight (ton)','Tare','IMO','Ocean Vessel','Ocean carrier','OCean BL No','Stock','Consignee','Forwarder','Forwarder VAT NO','SKK/KFK'];
  const headers=['Cont. No','Booking No',...removed,'Client','Terminal status'];
  const values=['MSCU1234567','BOOK1',...removed.map((_,i)=>`removed-${i}`),'Example client','Old status'];
  const sheet={rows:[headers,values,['','BOOK2',...removed.map(()=>''),'Other client','']]};
  const workbook=markedWorkbook(sheet,{column:0,start:2},[['MSCU1234567']],0);
  const readback=new ExcelJS.Workbook(); await readback.xlsx.load(await workbook.xlsx.writeBuffer());
  const marked=readback.worksheets[0];
  assert.deepEqual(marked.getRow(1).values.slice(1),['Cont. No','Booking No','Client','Terminal status']);
  assert.deepEqual(marked.getRow(2).values.slice(1),['MSCU1234567','BOOK1','Example client','Delivered']);
  assert.equal(marked.getCell('C3').value,'Other client');
  assert.equal(marked.getCell('D3').value,'No containernumber');
  assert.equal(marked.getCell('D2').fill.fgColor.argb,'FFDDF1E4');
  assert.equal(marked.getCell('D3').fill.fgColor.argb,'FFE8EBEF');
});
test('legacy Excel import, automatic column selection and row highlighting', async () => {
  const X = require('@e965/xlsx');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'checker-legacy-'));
  try {
    const rows = [['Loading list'], [], ['Vessel','','','','M/V TEST'], [], [], ['No','Size','','Type','Cont. No','Booking No'], [1,"40'",'','HC','','BOOK1'], [2,"40'",'','HC','MSCU1234567','BOOK2'], [3,"20'",'','DV','ABCD7654321','BOOK3'], [4,"40'",'','HC','MSCU1234567','BOOK2'], ['Total','','','','TOTAL units: 4']];
    const book = X.utils.book_new(); X.utils.book_append_sheet(book,X.utils.aoa_to_sheet(rows),'Loading');
    const file = path.join(dir,'loading.xls'); X.writeFile(book,file,{bookType:'biff8'});
    const [sheet] = await readList(file), selection = suggestSelection(sheet.rows,'vessel');
    assert.deepEqual(selection,{column:4,start:7});
    assert.deepEqual(suggestSelection([['Group','Sort','Unit Id'],['Containers','Container','MSCU1234567']],'quay'),{column:2,start:2});
    const data=overview(sheet,selection,[['MSCU1234567']],0);
    assert.equal(data.loadingRows.length,4); assert.equal(data.missingNumbers,1);
    assert.equal(data.bookedTotal,4); assert.equal(data.numberedRows,3); assert.equal(data.awaitingNumbers,2); assert.equal(data.blankBookingRows,1);
    assert.deepEqual(data.loadingRows.map(r=>r.status),['No containernumber','Delivered','Outstanding','Delivered']);
    const output=path.join(dir,'marked.xlsx'); await markedWorkbook(sheet,selection,[['MSCU1234567']],0).xlsx.writeFile(output);
    const readback=new ExcelJS.Workbook(); await readback.xlsx.readFile(output); const marked=readback.worksheets[0];
    assert.equal(marked.getCell('G8').value,'Delivered'); assert.equal(marked.getCell('E8').fill.fgColor.argb,'FFDDF1E4');
    assert.equal(marked.getCell('G7').value,'No containernumber'); assert.equal(marked.getCell('G9').value,'Outstanding'); assert.equal(marked.getCell('G10').value,null);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('counts split bills of lading as one container and keeps unnumbered bookings', () => {
  const sheet={rows:[['No','Size','','Type','Cont. No','Booking No'],[1,'40','','HC','','BOOK1'],[2,'40','','HC','MSCU1234567','BOOK2'],[3,'40','','HC','MSCU1234567','BOOK2'],['Total','','','','TOTAL units: 2'],[],['Footer']]};
  const result=overview(sheet,{column:4,start:2},[['MSCU1234567']],0);
  assert.equal(result.bookedTotal,2); assert.equal(result.countedBookingRows,3);
  assert.equal(result.countedContainers,2); assert.equal(result.numberedContainers,1); assert.equal(result.additionalBillRows,1);
  const withoutTotal=overview({rows:sheet.rows.slice(0,4)},{column:4,start:2},[],0);
  assert.equal(withoutTotal.bookedTotal,2);
  assert.equal(result.numberedRows,2); assert.equal(result.awaitingNumbers,1);
  assert.equal(result.loadingRows.length,3);
  const allMissing=overview({rows:[sheet.rows[0],sheet.rows[1]]},{column:4,start:2},[],0);
  assert.equal(allMissing.bookedTotal,1); assert.equal(allMissing.numberedRows,0); assert.equal(allMissing.awaitingNumbers,1);
});
test('matches normalized numbers, counts unique containers and excludes invalid rows', () => {
  const result = compare([[' ms cu-1234567 '], ['MSCU1234567'], ['ABCD7654321'], ['bad'], ['']], 0, [['MSCU1234567'], ['ZZZZ1234567']], 0);
  assert.deepEqual(result.results, [{ container:'ABCD7654321',status:'Outstanding' },{ container:'MSCU1234567',status:'Delivered' }]);
  assert.deepEqual(result.quayOnly,['ZZZZ1234567']);
  assert.equal(result.vessel.duplicates,1); assert.equal(result.vessel.invalid,1); assert.equal(result.vessel.blank,1);
});
test('reads real Excel workbooks including sheets, blank rows, rich text and formula results', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'checker-'));
  try {
    const book = new ExcelJS.Workbook(), vessel = book.addWorksheet('Vessel'), quay = book.addWorksheet('Quay');
    vessel.addRow(['Reference','Container']); vessel.addRow(['A','MSCU1234567']); vessel.addRow([]); vessel.addRow(['B',{ richText:[{text:'ABCD'},{text:'7654321'}] }]);
    quay.addRow(['Container']); quay.addRow([{formula:'"MSCU1234567"',result:'MSCU1234567'}]);
    const file = path.join(dir,'lists.xlsx'); await book.xlsx.writeFile(file);
    const sheets = await readList(file);
    assert.equal(sheets.length,2); assert.equal(sheets[0].rows[2][1],'');
    const result = compare(sheets[0].rows.slice(1),1,sheets[1].rows.slice(1),0);
    assert.equal(result.results.length,2); assert.equal(result.results.filter(r=>r.status==='Delivered').length,1);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('reads BOM and semicolon CSV files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'checker-'));
  try { const file=path.join(dir,'list.csv'); await fs.writeFile(file,'\uFEFFReference;Container\r\n1;MSCU1234567\r\n'); const sheets=await readList(file); assert.equal(sheets[0].rows[1][1],'MSCU1234567'); }
  finally { await fs.rm(dir,{recursive:true,force:true}); }
});
test('desktop import, comparison and export handlers process Excel end to end', async () => {
  const vm = require('node:vm');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'checker-desktop-'));
  try {
    const inputs = [];
    for (const [name, numbers] of [['vessel',['MSCU1234567','ABCD7654321']],['quay',['MSCU1234567']]]) {
      const book = new ExcelJS.Workbook(), sheet = book.addWorksheet('Containers');
      sheet.addRow(['Container']); numbers.forEach(number=>sheet.addRow([number]));
      const file = path.join(dir,name+'.xlsx'); await book.xlsx.writeFile(file); inputs.push(file);
    }
    const output = path.join(dir,'results.xlsx'), handlers = new Map();
    const electron = { app:{whenReady:()=>({then:()=>{}}),on:()=>{}}, BrowserWindow:class {}, ipcMain:{handle:(name,handler)=>handlers.set(name,handler)},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[inputs.shift()]}),showSaveDialog:async()=>({canceled:false,filePath:output})} };
    vm.runInNewContext(await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8'), {require:name=>name==='electron'?electron:name==='./import'?require('../src/import'):name==='./compare'?require('../src/compare'):name==='./overview'?require('../src/overview'):name==='./marked-workbook'?require('../src/marked-workbook'):name==='./updates'?require('../src/updates'):require(name),__dirname:path.join(__dirname,'../src')});
    assert.equal((await handlers.get('import')(null,'vessel')).sheets[0].count,3);
    await handlers.get('import')(null,'quay');
    const selections={vessel:{sheet:0,column:0,start:2},quay:{sheet:0,column:0,start:2}};
    const result=handlers.get('compare')(null,selections);
    assert.equal(result.results.filter(r=>r.status==='Delivered').length,1);
    assert.equal(handlers.has('export'),false);
    assert.equal(await handlers.get('export-marked')(null,selections),true);
    const marked = new ExcelJS.Workbook(); await marked.xlsx.readFile(output);
    assert.equal(marked.worksheets[0].getCell('B2').value,'Delivered');
    assert.equal(marked.worksheets[0].getCell('B3').value,'Outstanding');
    assert.throws(()=>handlers.get('compare')(null,{...selections,vessel:{sheet:0,column:0,start:0}}));
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test('Excel removes duplicates within a booking, preserves other bookings, and reports conflicts', async () => {
  const source={rows:[['Loading list'],['Cont. No','Booking No','Client'],['MSCU1234567','BOOK1','First client'],[' mscu-1234567 ',' book1 ','Duplicate client'],['MSCU1234567','BOOK2','Second client'],['','BOOK3','Blank one'],['','BOOK3','Blank two'],['ABCD7654321','BOOK4','Other client'],['TOTAL units: 4']]};
  const data=overview(source,{column:0,start:3},[['MSCU1234567']],0,-1);
  assert.deepEqual(data.bookingConflicts,[{container:'MSCU1234567',bookings:['BOOK1','BOOK2']}]);
  assert.equal(data.numberedContainers,2);assert.equal(data.awaitingNumbers,2);
  const bytes=await markedWorkbook(source,{column:0,start:3},[['MSCU1234567']],0,-1).xlsx.writeBuffer();
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);const sheet=book.worksheets[0];
  assert.equal(sheet.rowCount,8);
  assert.deepEqual(sheet.getRow(3).values.slice(1),['MSCU1234567','BOOK1','First client','Delivered']);
  assert.deepEqual(sheet.getRow(4).values.slice(1),['MSCU1234567','BOOK2','Second client','Delivered']);
  assert.equal(sheet.getCell('D5').value,'No containernumber');assert.equal(sheet.getCell('C5').value,'Blank one');
  assert.equal(sheet.getCell('D6').value,'No containernumber');assert.equal(sheet.getCell('C6').value,'Blank two');
  assert.equal(sheet.getCell('D7').value,'Outstanding');assert.equal(sheet.getCell('A8').value,'TOTAL units: 4');
  assert.equal(source.rows.length,9);
  assert.deepEqual(overview({rows:source.rows.slice(0,4)},{column:0,start:3},[],0,-1).bookingConflicts,[]);
});

test('awaiting uses booked minus unique received; TEU includes blocked and deduplicates split bills', () => {
  const sheet={rows:[['Size','','Cont. No','Booking No'],["20'",'','MSCU1234567','A'],["20'",'','MSCU1234567','A'],['',"45'",'ABCD7654321','B'],["40'",'','CMAU1234567','C'],["40'",'','','D'],['TOTAL units: 6 TOTAL TEUs: 11']]};
  const result=overview(sheet,{column:2,start:2},[['MSCU1234567','Yes'],['MSCU1234567','Yes'],['ABCD7654321','No'],['OTHER1234567','No']],0,1);
  assert.equal(result.numberedContainers,3);assert.equal(result.awaitingNumbers,3);assert.equal(result.blankBookingRows,1);
  assert.equal(result.bookedTeu,11);assert.equal(result.terminalTeu,3);
  assert.equal(result.loadingRows[2].size,"45'");
  const fallback=overview({rows:sheet.rows.slice(0,-1)},{column:2,start:2},[],0,-1);
  assert.equal(fallback.bookedTeu,7);assert.equal(fallback.terminalTeu,0);
  const unknown=overview({rows:[sheet.rows[0],['','','MSCU1234567','A']]},{column:2,start:2},[['MSCU1234567']],0,-1);
  assert.equal(unknown.bookedTeu,null);assert.equal(unknown.terminalTeu,null);
});

test('marked Excel retains the full Gross value and makes the column wide enough', async () => {
  const source={rows:[['Cont. No','Booking No','Gross'],['MSCU1234567','A','123456789012345.678900'],['','B','33.200']]};
  const book=new ExcelJS.Workbook();await book.xlsx.load(await markedWorkbook(source,{column:0,start:2},[],0,-1).xlsx.writeBuffer());
  const sheet=book.worksheets[0];assert.equal(sheet.getCell('C1').value,'Gross');
  assert.equal(sheet.getCell('C2').value,'123456789012345.678900');assert.equal(sheet.getCell('C3').value,'33.200');
  assert.ok(sheet.getColumn(3).width >= 23);
  sheet.eachRow(row => row.eachCell(cell => assert.equal(cell.alignment.horizontal,'left')));assert.equal(sheet.getCell('D2').value,'Outstanding');
});

test('Excel sorts whole booking rows A to Z, preserves totals and styles, and puts missing bookings last', async () => {
  const source={rows:[['Loading list'],['Cont. No','Booking No','Gross'],['MSCU1234567','Z002','33.200'],['ABCD7654321','A001','4.500'],['','a001','1.250'],['CMAU1234567','B003','9.000'],['MSCU1234567','Z002','33.200'],['ZZZZ1234567','','2.000'],['TOTAL units: 5']]};
  const original=JSON.stringify(source);
  const book=new ExcelJS.Workbook();await book.xlsx.load(await markedWorkbook(source,{column:0,start:3},[['MSCU1234567','Yes'],['ABCD7654321','No']],0,1).xlsx.writeBuffer());
  const sheet=book.worksheets[0];
  assert.equal(sheet.getCell('A1').value,'Loading list');assert.equal(sheet.getCell('B2').value,'Booking No');
  assert.deepEqual([3,4,5,6,7].map(r=>sheet.getCell('B'+r).value),['A001','a001','B003','Z002','']);
  assert.equal(sheet.getCell('A3').value,'ABCD7654321');assert.equal(sheet.getCell('C3').value,'4.500');assert.equal(sheet.getCell('D3').value,'Delivered');
  assert.equal(sheet.getCell('D4').value,'No containernumber');
  assert.equal(sheet.getCell('A6').value,'MSCU1234567');assert.equal(sheet.getCell('D6').value,'Blocked');assert.equal(sheet.getCell('A6').fill.fgColor.argb,'FF8B1E2D');
  assert.equal(sheet.getCell('A8').value,'TOTAL units: 5');assert.equal(JSON.stringify(source),original);
});

test('23 ft counts as 3 TEU in booked and terminal totals without counting split bills twice', () => {
  const rows=[['Size','','Cont. No','Booking No'],["20'",'','MSCU1234567','A'],['',"23'",'CEXU3503017','B'],['',"23'",'CEXU3503017','C'],["40'",'','ABCD7654321','D'],['',"23'",'','E']];
  const quay=[['MSCU1234567','No'],['CEXU3503017','Yes']];
  const data=overview({rows:[...rows,['TOTAL units: 4 TOTAL TEUs: 5']]},{column:2,start:2},quay,0,1);
  assert.equal(data.terminalTeu,4);
  assert.equal(data.bookedTeu,9);
  assert.equal(data.numberedContainers,3);
  assert.equal(overview({rows},{column:2,start:2},quay,0,1).bookedTeu,9);
});
