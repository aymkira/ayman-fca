// ============================================================
//  AYMAN-FCA v2.0 — Messenger Notes API
//  © 2025 Ayman. All Rights Reserved.
//  مستوحى من: ws3-fca
//
//  api.notes.create(text, privacy?)
//  api.notes.delete(noteID)
//  api.notes.check()
//  api.notes.recreate(oldID, newText)
// ============================================================
"use strict";

const logger = require("../../../func/logger");

module.exports = function(defaultFuncs, api, ctx) {

  async function request(form) {
    const res  = await defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form);
    const data = res?.data || res;
    if (data?.errors) throw data.errors[0];
    return data;
  }

  function checkNote(callback) {
    if (typeof callback !== "function") callback = () => {};
    const form = {
      fb_api_caller_class:      "RelayModern",
      fb_api_req_friendly_name: "MWInboxTrayNoteCreationDialogQuery",
      variables:                JSON.stringify({ scale: 2 }),
      doc_id:                   "30899655739648624"
    };
    request(form)
      .then(d => callback(null, d?.data?.viewer?.actor?.msgr_user_rich_status || null))
      .catch(err => { logger(`[ AYMAN ] notes.check: ${err?.message || err}`, "error"); callback(err); });
  }

  function createNote(text, privacy = "EVERYONE", callback) {
    if (typeof privacy === "function") { callback = privacy; privacy = "EVERYONE"; }
    if (typeof callback !== "function") callback = () => {};
    const form = {
      fb_api_caller_class:      "RelayModern",
      fb_api_req_friendly_name: "MWInboxTrayNoteCreationDialogCreationStepContentMutation",
      variables: JSON.stringify({
        input: {
          client_mutation_id: String(Math.round(Math.random() * 10)),
          actor_id:           ctx.userID,
          description:        text,
          duration:           86400,
          note_type:          "TEXT_NOTE",
          privacy,
          session_id:         String(Date.now())
        }
      }),
      doc_id: "24060573783603122"
    };
    request(form)
      .then(d => {
        const status = d?.data?.xfb_rich_status_create?.status;
        if (!status) throw new Error("AYMAN-FCA: لم يُعثر على status");
        callback(null, status);
      })
      .catch(err => { logger(`[ AYMAN ] notes.create: ${err?.message || err}`, "error"); callback(err); });
  }

  function deleteNote(noteID, callback) {
    if (typeof callback !== "function") callback = () => {};
    const form = {
      fb_api_caller_class:      "RelayModern",
      fb_api_req_friendly_name: "useMWInboxTrayDeleteNoteMutation",
      variables: JSON.stringify({
        input: {
          client_mutation_id: String(Math.round(Math.random() * 10)),
          actor_id:           ctx.userID,
          rich_status_id:     noteID
        }
      }),
      doc_id: "9532619970198958"
    };
    request(form)
      .then(d => callback(null, d?.data?.xfb_rich_status_delete))
      .catch(err => { logger(`[ AYMAN ] notes.delete: ${err?.message || err}`, "error"); callback(err); });
  }

  function recreateNote(oldNoteID, newText, callback) {
    if (typeof callback !== "function") callback = () => {};
    deleteNote(oldNoteID, (err, deleted) => {
      if (err) return callback(err);
      createNote(newText, (err2, created) => {
        if (err2) return callback(err2);
        callback(null, { deleted, created });
      });
    });
  }

  return {
    create:   createNote,
    delete:   deleteNote,
    check:    checkNote,
    recreate: recreateNote
  };
};
