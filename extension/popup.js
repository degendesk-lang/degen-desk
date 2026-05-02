const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

const input = document.getElementById("ca-input");
const btn = document.getElementById("open-btn");
const errEl = document.getElementById("ca-error");

function setError(msg) {
  if (msg) {
    errEl.textContent = msg;
    errEl.hidden = false;
  } else {
    errEl.hidden = true;
  }
}

function validate(v) {
  return SOL_RE.test(v) || EVM_RE.test(v);
}

input.addEventListener("input", () => {
  const v = input.value.trim();
  btn.disabled = !validate(v);
  if (v && !validate(v)) {
    setError("Doesn't match Solana or EVM address format.");
  } else {
    setError(null);
  }
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !btn.disabled) {
    e.preventDefault();
    open();
  }
});

btn.addEventListener("click", open);

function open() {
  const v = input.value.trim();
  if (!validate(v)) return;
  chrome.runtime.sendMessage({ type: "OPEN_REPORT", address: v }, () => {
    window.close();
  });
}

// Auto-paste from clipboard if it looks like a CA — friendly UX.
(async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && validate(text.trim())) {
      input.value = text.trim();
      input.dispatchEvent(new Event("input"));
    }
  } catch (_) {
    // clipboard read can fail without permission — silently ignore
  }
  input.focus();
})();
