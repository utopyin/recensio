import { useAtomSet } from "@effect/atom-react/Hooks";
import { Button } from "@recensio/ui/button";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { Auth } from "@/auth";

export const Route = createFileRoute("/sign-in")({
  // Someone already signed in has nothing to do here.
  beforeLoad: async () => {
    if ((await Auth.session()) !== null) throw redirect({ to: "/" });
  },
  component: SignIn,
});

const input =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-2";

/** Signed in: a full load, so the page that comes next asks who is signed in. */
const enter = () => {
  Auth.forget();
  window.location.assign("/");
};

/** An address, then the code sent to it. What this page holds is its own: no other page reads it. */
function SignIn() {
  const [pending, setPending] = useState<Auth.Pending | null>(null);
  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center gap-6 p-8">
      {pending === null ? (
        <Address onSent={setPending} />
      ) : (
        <Code pending={pending} onSent={setPending} onBack={() => setPending(null)} />
      )}
    </main>
  );
}

function Address({ onSent }: { readonly onSent: (pending: Auth.Pending) => void }) {
  const requestCode = useAtomSet(Auth.requestCode, { mode: "promise" });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    requestCode(email).then(onSent, () => {
      setBusy(false);
      setFailed(true);
    });
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sign in to Recensio</h1>
        <p className="text-muted-foreground text-sm">
          Enter your email and we will send you a code.
        </p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={send}>
        <input
          className={input}
          type="email"
          name="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {failed && (
          <p className="text-destructive text-sm">
            The code could not be sent. Check the address, or try again in a moment.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send me a code"}
        </Button>
      </form>
    </>
  );
}

function Code(props: {
  readonly pending: Auth.Pending;
  readonly onSent: (pending: Auth.Pending) => void;
  readonly onBack: () => void;
}) {
  const enterCode = useAtomSet(Auth.enterCode, { mode: "promise" });
  const requestCode = useAtomSet(Auth.requestCode, { mode: "promise" });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setWrong(false);
    enterCode({ pending: props.pending, code: code.trim() }).then(enter, () => {
      setBusy(false);
      setWrong(true);
    });
  };

  const again = () => {
    setCode("");
    setWrong(false);
    requestCode(props.pending).then(props.onSent, () => setWrong(true));
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-muted-foreground text-sm">
          If <span className="text-foreground font-medium">{props.pending.email}</span> can sign in,
          a six-digit code is on its way. It works for five minutes.
        </p>
      </div>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <input
          className={`${input} font-mono tracking-[0.3em] tabular-nums`}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          aria-invalid={wrong}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {wrong && (
          <p className="text-destructive text-sm">
            That code did not work. Check it, or ask for a new one.
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="flex justify-between">
        <Button variant="ghost" size="sm" onClick={again}>
          Send a new code
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onBack}>
          Use another email
        </Button>
      </div>
    </>
  );
}
