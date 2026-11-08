module.exports = async function (window) {
  return window.webContents.executeJavaScript(`(async()=>{
    const until=async(fn,label)=>{for(let i=0;i<100;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,50));}throw Error('Formal UI timeout: '+label);};
    const button=async(text,root=document)=>{const el=await until(()=>Array.from(root.querySelectorAll('button')).find(b=>b.textContent.trim()===text),text);el.click();};
    const dialog=()=>document.querySelector('dialog[open]');
    document.querySelector('.course-nav-item').click();await button('Открыть');
    await button('Формальные проверки');await until(()=>dialog(),'checks dialog');
    await button('Запустить проверки',dialog());await until(()=>dialog()?.querySelector('.formal-results'),'results');
    if(!dialog().innerText.includes('Синтаксис Python: не проверяется.'))throw Error('Missing honest syntax status');
    await button('К ячейке 1',dialog());await until(()=>dialog()?.querySelector('.source-text'),'source navigation');
    await button('Запустить проверки',dialog());await until(()=>dialog()?.querySelectorAll('option').length===2,'second run');
    await button('×',dialog());await until(()=>!dialog(),'close');
    await button('Редактировать задание');await until(()=>dialog()?.querySelector('[name="formalChecks"]'),'settings');
    const field=dialog().querySelector('input[placeholder="Task1_{Имя}.ipynb"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Task1_{Имя}.ipynb');field.dispatchEvent(new Event('input',{bubbles:true}));
    await until(()=>JSON.parse(dialog().querySelector('[name="formalChecks"]').value).filenamePattern==='Task1_{Имя}.ipynb','controlled settings');
    dialog().querySelector('form').requestSubmit();await until(()=>!dialog(),'save');
    await button('Редактировать задание');await until(()=>dialog()?.querySelector('input[placeholder="Task1_{Имя}.ipynb"]')?.value==='Task1_{Имя}.ipynb','persisted settings');
    await button('Отмена',dialog());await until(()=>!dialog(),'cancel');
    return {formalSettings:true,formalResults:true,repeatRun:true,cellNavigation:true};
  })()`);
};
