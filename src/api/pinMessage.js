"use strict";
const utils = require("../utils");
module.exports = function(defaultFuncs, api, ctx){
  return function pinMessage(messageID, threadID, callback){
    let resolveFunc, rejectFunc;
    const returnPromise = new Promise((res,rej)=>{ resolveFunc=res; rejectFunc=rej; });
    if (!callback) callback = (err,data)=> err ? rejectFunc(err) : resolveFunc(data);
    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, {
        doc_id: "2380599842158525",
        variables: JSON.stringify({ messageID, threadID, isPinnedMessage: true })
      }, ctx.globalOptions, ctx)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(resData=>{ if(resData.error) throw resData; callback(null,{success:true}); })
      .catch(err=>callback(err));
    return returnPromise;
  };
};
forwardMessage.js:
"use strict";
const utils = require("../utils");
module.exports = function(defaultFuncs, api, ctx){
  return function forwardMessage(messageID, threadID, callback){
    let resolveFunc, rejectFunc;
    const returnPromise = new Promise((res,rej)=>{ resolveFunc=res; rejectFunc=rej; });
    if (!callback) callback = (err,data)=> err ? rejectFunc(err) : resolveFunc(data);
    defaultFuncs
      .post("https://www.facebook.com/api/graphql/", ctx.jar, {
        doc_id: "3218892511542012",
        variables: JSON.stringify({
          message: { forwarded_message_id: messageID },
          thread_id: threadID
        })
      }, ctx.globalOptions, ctx)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(resData=>{ if(resData.error) throw resData; callback(null,{success:true}); })
      .catch(err=>callback(err));
    return returnPromise;
  };
};
getRegion.js:
"use strict";
module.exports = function(defaultFuncs, api, ctx){
  return function getRegion(){ return ctx?.region || null; };
};
