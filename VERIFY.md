# End-to-end live verification

The app is fully built and unit-tested, but **no message has yet gone through a real
Meta WhatsApp account**. This checklist proves the whole pipeline works end to end.
You do the Meta-side steps (I can't enter your credentials); I watch the logs and fix
anything that breaks.

Live app: `https://wa-broadcast-production-0392.up.railway.app`
Webhook callback URL: `https://wa-broadcast-production-0392.up.railway.app/api/webhooks/whatsapp`

---

## A. Connect a real WhatsApp number (~10 min)
From Meta → [developers.facebook.com](https://developers.facebook.com) → your app → WhatsApp:

- [ ] Collect: **Phone number ID**, **WhatsApp Business Account (WABA) ID**, **App ID**
      (App → Settings → Basic), a **permanent System-User access token**, the **App Secret**.
- [ ] Pick a **webhook verify token** — any random string you choose (e.g. a UUID).
- [ ] In the app: **Settings → Connect WhatsApp** → paste all of the above + the verify
      token → **Save** → **Test connection**. Expect it to return your number's
      verified name + display number.
- [ ] Meta → WhatsApp → **Configuration** → Webhook:
  - Callback URL = the URL above
  - Verify token = the one you set
  - Click **Verify and save** (the app answers the handshake)
  - **Subscribe** to the **`messages`** field (and **`message_template_status_update`**).

> Multi-client note: to test a second client, switch into it (nav dropdown) and repeat
> Connect WhatsApp with that client's own number. Webhooks route by WABA id automatically.

## B. Send a broadcast (you send, I watch the worker)
- [ ] **Contacts → Add contact**: add your own WhatsApp number; attach it to a new list.
- [ ] **Templates**: sync (`?sync=1` happens on the page) or create one and wait for Meta
      approval. Confirm at least one **APPROVED** template appears.
- [ ] **Dashboard → New broadcast**: pick the template + your 1-contact list → **Send now**.
- [ ] Confirm: you receive the message on WhatsApp, and the broadcast detail page shows
      **SENT → DELIVERED → READ**.

### Rich templates (each needs its own approved template)
- [ ] **Media header** template → broadcast asks for a media URL → image/PDF arrives.
- [ ] **Coupon (copy-code)** template → broadcast asks for a code → tap-to-copy works.
- [ ] **Carousel** template → cards arrive as a swipeable gallery.

## C. Two-way inbox (you reply from your phone, I watch the webhook)
- [ ] Reply to the message from your WhatsApp → it appears in **/inbox** with an unread badge.
- [ ] Open the thread → the unread clears and a **read receipt** (✓✓ blue) shows on your phone.
- [ ] Reply from the inbox with **text** → it arrives on your phone.
- [ ] Reply from the inbox with an **attachment** (📎) → it arrives.
- [ ] Send an inbound **image/voice note** → it renders in the thread.
- [ ] Send **STOP** → confirm the contact is opted out (Contacts shows opted-out;
      future broadcasts skip them).

---

When you're ready to run section B/C, tell me and I'll tail the worker + webhook logs
live so we catch any real-world payload issue immediately.
