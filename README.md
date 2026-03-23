AYMAN-FCA 🤖

> مكتبة غير رسمية للتواصل مع Facebook Messenger عبر Node.js
> مخصصة لبوت **KIRA**

---

## 👤 المطور

**Ayman** — جميع الحقوق محفوظة © 2025

---

## 📦 التثبيت

```bash
npm install ayman-fca
```

---

## 🚀 الاستخدام الأساسي

```javascript
const login = require("ayman-fca");
const fs = require("fs");

const appState = JSON.parse(fs.readFileSync("appstate.json", "utf8"));

login({ appState }, (err, api) => {
  if (err) return console.error("خطأ في اللوجين:", err);

  console.log("✅ KIRA بوت متصل!");

  api.listenMqtt((err, message) => {
    if (err) return;
    if (message.type === "message") {
      api.sendMessage("مرحباً! أنا KIRA 🤖", message.threadID);
    }
  });
});
```

---

## ⚙️ ملف الإعدادات `fca-config.json`

```json
{
  "autoUpdate": false,
  "mqtt": {
    "enabled": true,
    "reconnectInterval": 3600
  }
}
```

---

## 📋 الميزات

- ✅ إرسال واستقبال الرسائل عبر MQTT
- ✅ حماية من الكراش التلقائي
- ✅ حفظ AppState تلقائي
- ✅ إعادة اتصال تلقائية
- ✅ دعم المرفقات والصور والفيديو
- ✅ دعم التفاعلات والردود
- ✅ لا يُرسل أي بيانات لسيرفرات خارجية

---

## 🔒 الأمان

هذه المكتبة لا تُرسل أي بيانات لأي سيرفر خارجي.
كل شيء يعمل على جهازك/سيرفرك فقط.

---

## 📄 الترخيص

MIT License — المطور: **Ayman**
