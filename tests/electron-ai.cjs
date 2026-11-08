module.exports = async function (window) {
  return window.webContents.executeJavaScript(`(async()=>{
    const call=async(name,p)=>{const result=await window.practicum[name](p);if(!result.ok)throw Error(result.error);return result.data;};
    const state=await call('state'),course=state.courses[0],assignment=course.assignments[0],work=assignment.works[0];
    const p={profileId:state.active,courseId:course.id,assignmentId:assignment.id,importId:work.importId};
    const copy=await call('prepareSubmission',p);
    await call('savePreparedCopy',{...p,expectedId:copy.id,body:copy.body,reviewed:true});
    const run=await call('runAiCheck',p);if(run.status!=='completed')throw Error('Mock IPC run failed: '+run.error);
    const invalid=await call('runAiCheck',{...p,scenario:'invalid-json'});if(invalid.status!=='failed')throw Error('Invalid response accepted');
    return {mockIpc:true,invalidResponseRejected:true};
  })()`);
};
