module.exports = async function checkAuthReviewUi(window) {
  window.setSize(1000, 650);
  return window.webContents.executeJavaScript(`(async()=>{
    const until=async(fn,label)=>{for(let i=0;i<100;i++){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,50));}throw Error('UI timeout: '+label);};
    const dialog=()=>document.querySelector('dialog[open]');
    const button=async(text,scope=document)=>{const el=await until(()=>Array.from(scope.querySelectorAll('button')).find(b=>b.textContent.trim()===text || (text==='Сменить профиль' && b.textContent.includes(text))),text);el.click();};
    const closed=()=>until(()=>!dialog(),'dialog close');
    const input=(name,value)=>{const el=dialog().querySelector('[name="'+name+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
    const profileButton=async name=>(await until(()=>Array.from(document.querySelectorAll('.profile-option')).find(b=>b.querySelector('strong').textContent===name),'profile')).click();
    function sticky(){const body=dialog().querySelector('.dialog-body'),close=dialog().querySelector('[aria-label="Закрыть"]');const before=close.getBoundingClientRect().top;body.scrollTop=body.scrollHeight;const after=close.getBoundingClientRect();if(Math.abs(after.top-before)>1||after.top<dialog().getBoundingClientRect().top||after.bottom>dialog().getBoundingClientRect().bottom)throw Error('Close button scrolled away');}
    document.querySelector('.course-nav-item').click();await button('Архивировать');await until(()=>dialog(),'archive');await button('Подтвердить архивирование',dialog());await closed();
    await until(()=>!document.querySelector('.assignment'),'assignment hidden');document.querySelector('.checkline input').click();await button('Восстановить');await until(()=>!document.querySelector('.assignment'),'restored out of archive');document.querySelector('.checkline input').click();await button('Открыть');
    await button('Оценить');await until(()=>dialog()?.querySelector('input[type="number"]'),'review');
    sticky();await button('Утвердить оценку',dialog());await until(()=>dialog()?.innerText.includes('всем критериям'),'required scores');
    const score=dialog().querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(score,'4.5');score.dispatchEvent(new Event('input',{bubbles:true}));
    await button('Сохранить черновик',dialog());await until(()=>dialog()?.innerText.includes('Черновик сохранён'),'draft');
    await button('Утвердить оценку',dialog());await until(()=>dialog()?.innerText.includes('Оценка утверждена'),'approved');
    if(!dialog().querySelector('input[type="number"]').disabled)throw Error('Approved grade is editable');
    await button('Скопировать отзыв',dialog());await until(()=>dialog()?.innerText.includes('Отзыв скопирован'),'copy feedback');
    await button('Создать исправление',dialog());
    const correction=dialog().querySelector('input[type="number"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(correction,'4');correction.dispatchEvent(new Event('input',{bubbles:true}));
    await button('Утвердить оценку',dialog());await until(()=>dialog()?.innerText.includes('Оценка утверждена'),'correction');
    await button('×',dialog());await closed();await until(()=>document.querySelector('.grade-summary')?.textContent.includes('Оценка преподавателя: 4'),'grade columns');
    if(!document.querySelector('.grade-summary').textContent.includes('Оценка ИИ: —'))throw Error('AI placeholder missing');
    await button('Редактировать задание');await until(()=>dialog(),'assignment modal');sticky();
    dialog().dispatchEvent(new Event('cancel',{cancelable:true}));await closed();
    await button('Сменить профиль');await until(()=>document.querySelector('.profile-option'),'profiles');await button('Новый профиль');await until(()=>dialog(),'new profile');
    input('name','Новый проверочный профиль');input('password','dev');input('passwordRepeat','dev');dialog().querySelector('form').requestSubmit();
    const code=await until(()=>document.querySelector('.recovery-code')?.textContent,'one-time code');
    await button('Я сохранил код');await closed();
    if(document.querySelector('.metrics')||document.body.innerText.includes('Локальное приложение'))throw Error('Redundant UI remained');
    await button('Сменить пароль');await until(()=>dialog(),'change password');input('currentPassword','dev');input('password','new');input('passwordRepeat','new');dialog().querySelector('form').requestSubmit();
    const newCode=await until(()=>document.querySelector('.recovery-code')?.textContent,'new recovery code');if(code===newCode)throw Error('Recovery code did not rotate');await button('Я сохранил код');await closed();
    await button('Сменить профиль');await until(()=>document.querySelector('.profile-option'),'profiles');await profileButton('Новый проверочный профиль');await until(()=>dialog(),'login');input('password','bad');dialog().querySelector('form').requestSubmit();await until(()=>dialog()?.innerText.includes('Неверный пароль'),'wrong password');
    await button('Забыли пароль?',dialog());await until(()=>dialog()?.querySelector('[name="recoveryCode"]'),'recovery');input('recoveryCode',newCode);input('password','reset');input('passwordRepeat','reset');dialog().querySelector('form').requestSubmit();await until(()=>document.querySelector('.recovery-code'),'reset code');await button('Я сохранил код');await closed();
    await button('Сменить профиль');await until(()=>document.querySelector('.profile-option'),'profiles');await profileButton('Новый проверочный профиль');await until(()=>dialog(),'login');input('password','reset');dialog().querySelector('form').requestSubmit();await closed();await until(()=>document.querySelector('.grid'),'logged in');
    return {passwordCreation:true,passwordLogin:true,passwordChange:true,recovery:true,archiveRestore:true,teacherReview:true,separateScores:true,stickyHeaders:true,copyFeedback:true};
  })()`);
};
