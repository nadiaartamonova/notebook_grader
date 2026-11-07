// Интеграционная проверка реальных компонентов React в изолированном окне Electron.
module.exports = async function checkLifecycleUi(window, page) {
  await window.webContents.executeJavaScript(`(async()=>{
    const state=(await window.practicum.state()).data;
    const course=state.courses[0];
    const p={profileId:state.active,courseId:course.id};
    const added=await window.practicum.addStudent({...p,name:'Editor Test',number:'EDIT002'});
    if(!added.ok)throw Error(added.error);
    const student=added.data.courses[0].students.find(s=>s.number==='EDIT002');
    const loaded=await window.practicum.importNotebook({...p,assignmentId:course.assignments[0].id,
      studentId:student.id,name:'other.ipynb',base64:btoa(JSON.stringify({nbformat:4,cells:[{cell_type:'code',source:'print(1)'}]}))});
    if(!loaded.ok)throw Error(loaded.error);
  })()`);
  await window.loadURL(page);
  return window.webContents.executeJavaScript(`(async()=>{
    const until=async(fn,label)=>{for(let i=0;i<100;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,50));}throw Error('UI timeout: '+label);};
    const button=async(text,scope=document)=>{const el=await until(()=>Array.from(scope.querySelectorAll('button')).find(b=>b.textContent.trim()===text),text);el.click();};
    const dialog=()=>document.querySelector('dialog[open]');
    const closed=()=>until(()=>!dialog(),'dialog closed');
    const setInput=(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};
    const row=()=>Array.from(document.querySelectorAll('.work-row')).find(r=>Array.from(r.querySelectorAll('p')).some(p=>p.textContent==='test.ipynb'));
    const courseButton=await until(()=>document.querySelector('.course-nav-item'),'course');courseButton.click();
    await button('Студенты');
    (await until(()=>Array.from(document.querySelectorAll('.student-card')).find(b=>b.textContent.includes('Тестовый Студент')),'student card')).click();
    await button('Редактировать студента');await until(()=>dialog(),'edit dialog');
    setInput(dialog().querySelector('[name="name"]'),'Тестовый Студент Исправлен');
    setInput(dialog().querySelector('[name="number"]'),'TEST-UPDATED');
    dialog().querySelector('form').requestSubmit();await closed();
    await until(()=>document.body.innerText.includes('TEST-UPDATED'),'student saved');
    await button('Исключить из группы');await until(()=>dialog(),'exclude dialog');
    dialog().querySelector('[name="confirm"]').click();dialog().querySelector('form').requestSubmit();
    await until(()=>dialog()?.innerText.includes('Сначала переназначьте'),'exclusion blocked');
    await button('Отмена',dialog());await closed();
    await button('Копия для ИИ',row());
    await until(()=>dialog()?.querySelector('[role="alert"]')?.textContent.includes('Имя студента в работе не найдено'),'zero-name warning');
    await button('×',dialog());await closed();
    await button('Изменить автора',row());await until(()=>dialog()?.querySelector('select'),'author dialog');
    const select=dialog().querySelector('select');select.value=Array.from(select.options).find(o=>o.textContent.includes('Editor Test')).value;select.dispatchEvent(new Event('change',{bubbles:true}));
    await button('Изменить автора',dialog());
    await until(()=>dialog()?.innerText.includes('Подтвердите сохранение новой версии'),'repeat confirmation required');
    dialog().querySelector('input[type="checkbox"]').click();await button('Изменить автора',dialog());await closed();
    await until(()=>!row(),'work moved');
    await button('Исключить из группы');await until(()=>dialog(),'exclude again');
    dialog().querySelector('[name="confirm"]').click();dialog().querySelector('form').requestSubmit();await closed();
    (await until(()=>Array.from(document.querySelectorAll('.student-card')).find(b=>b.textContent.includes('Editor Test')),'new author card')).click();
    await until(()=>row(),'moved work');await button('История работы',row());
    await until(()=>dialog()?.querySelector('.history-invalid'),'invalid copy history');
    if(dialog().querySelectorAll('ol li').length!==2)throw Error('Author history missing');
    await button('×',dialog());await closed();
    await button('Удалить работу',row());await until(()=>dialog(),'delete dialog');
    await button('Отмена',dialog());await closed();if(!row())throw Error('Cancel deleted work');
    await button('Удалить работу',row());await until(()=>dialog(),'delete confirm');
    await button('Подтвердить удаление',dialog());await closed();await until(()=>!row(),'work hidden');
    document.querySelector('.course-nav-item').click();await button('Открыть');await button('Редактировать задание');
    const input=await until(()=>dialog()?.querySelector('input[maxlength="150"]'),'criterion field');
    for(const field of dialog().querySelectorAll('[maxlength]')) {
      const ids=field.getAttribute('aria-describedby').split(' ');
      if(!ids.some(id=>document.getElementById(id)?.textContent.includes('/ '+field.maxLength+' символов')))throw Error('Missing character counter');
    }
    input.focus();input.setSelectionRange(0,input.value.length);
    const clipboard=new DataTransfer();clipboard.setData('text','x'.repeat(151));
    input.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:clipboard}));
    document.execCommand('insertText',false,'x'.repeat(151));
    await until(()=>dialog()?.innerText.includes('Вставленный текст не поместился'),'paste warning');
    if(input.value.length!==150)throw Error('Browser maxLength changed');
    await until(()=>dialog()?.innerText.includes('150 / 150 символов'),'updated character counter');
    await button('Отмена',dialog());await closed();
    return {editStudent:true,excludeStudent:true,changeAuthor:true,history:true,deleteWork:true,zeroNamesWarning:true,pasteWarning:true,counters:true};
  })()`);
};
