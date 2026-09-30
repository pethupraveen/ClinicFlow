import { resetTestChatAction, sendTestMessageAction } from "../actions";
import type { BotMessage, Choice } from "../engine";
import type { TranscriptEntry } from "../store";
import s from "./chat.module.css";

function Options({ choices, active }: { choices: Choice[]; active: boolean }) {
  return (
    <div className={s.options}>
      {choices.map((c) =>
        active ? (
          <form key={c.id} action={sendTestMessageAction}>
            <input type="hidden" name="choice" value={c.id} />
            <input type="hidden" name="label" value={c.title} />
            <button type="submit" className={s.option}>
              {c.title}
              {c.description ? <small>{c.description}</small> : null}
            </button>
          </form>
        ) : (
          <button key={c.id} type="button" className={s.option} disabled>
            {c.title}
          </button>
        ),
      )}
    </div>
  );
}

function BotBubble({ message, active }: { message: BotMessage; active: boolean }) {
  return (
    <div className={`${s.bubble} ${s.bot}`}>
      {message.text}
      {message.kind === "buttons" ? <Options choices={message.buttons} active={active} /> : null}
      {message.kind === "list" ? <Options choices={message.rows} active={active} /> : null}
    </div>
  );
}

/**
 * The in-app test chat. Server-rendered: every tap is a plain form submit, so
 * it works without JS. Only the latest bot turn's options are active.
 */
export function TestChat({ clinicName, entries }: { clinicName: string; entries: TranscriptEntry[] }) {
  const lastIn = entries.findLastIndex((e) => e.direction === "IN");
  return (
    <div className={s.chat}>
      <div className={s.head}>
        <span>
          {clinicName}
          <small>Test chat · you are the patient</small>
        </span>
        <form action={resetTestChatAction}>
          <button type="submit" className={s.reset}>
            Start over
          </button>
        </form>
      </div>
      <div className={s.log} aria-live="polite">
        {entries.length === 0 ? (
          <div className={s.empty}>
            <p>Say hi to your bot, exactly as a patient would on WhatsApp.</p>
            <form action={sendTestMessageAction}>
              <input type="hidden" name="text" value="hi" />
              <button type="submit" className={s.send} style={{ minHeight: 42, marginTop: 10 }}>
                Say “hi”
              </button>
            </form>
          </div>
        ) : null}
        {entries.map((e, i) => {
          if (e.direction === "IN") {
            const body = e.body as { kind: string; text?: string; id?: string; label?: string };
            return (
              <div key={e.id} className={`${s.bubble} ${s.me}`}>
                {body.kind === "text" ? body.text : (body.label ?? body.id)}
              </div>
            );
          }
          return <BotBubble key={e.id} message={e.body as BotMessage} active={i > lastIn} />;
        })}
      </div>
      <form action={sendTestMessageAction} className={s.compose}>
        <label htmlFor="test-chat-text" className="visually-hidden">
          Message
        </label>
        <input id="test-chat-text" name="text" className={s.input} placeholder="Type a message (e.g. your name, or “menu”)" maxLength={500} autoComplete="off" />
        <button type="submit" className={s.send}>
          Send
        </button>
      </form>
    </div>
  );
}
