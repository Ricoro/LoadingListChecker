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
    assert.equal(data.bookedTotal,4); assert.equal(data.numberedRows,3); assert.equal(data.awaitingNumbers,1);
    assert.deepEqual(data.loadingRows.map(r=>r.status),['Cannot match','Delivered','Outstanding','Delivered']);
    const output=path.join(dir,'marked.xlsx'); await markedWorkbook(sheet,selection,[['MSCU1234567']],0).xlsx.writeFile(output);
    const readback=new ExcelJS.Workbook(); await readback.xlsx.readFile(output); const marked=readback.worksheets[0];
    assert.equal(marked.getCell('G8').value,'Delivered'); assert.equal(marked.getCell('E8').fill.fgColor.argb,'FFDDF1E4');
    assert.equal(marked.getCell('G7').value,'Cannot match'); assert.equal(marked.getCell('G9').value,'Outstanding'); assert.equal(marked.getCell('G11').value,null);
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
    vm.runInNewContext(await fs.readFile(path.join(__dirname,'../src/main.js'),'utf8'), {require:name=>name==='electron'?electron:name==='./import'?require('../src/import'):name==='./compare'?require('../src/compare'):name==='./overview'?require('../src/overview'):name==='./marked-workbook'?require('../src/marked-workbook'):require(name),__dirname:path.join(__dirname,'../src')});
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
