import { playSfx, toggleMute, unlockSfx } from "./sfx.js";

export function bindEvents(root, dispatch) {
  let lastBotDifficulty = root.dataset.lastBotDifficulty || "medium";

  root.querySelectorAll("[data-action='toggle-sound']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      const muted = toggleMute();
      btn.classList.toggle("muted", muted);
      btn.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
    });
  });

  root.querySelectorAll("[data-action='go-home']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const phase = root.dataset.phase;
      const onlineActive = root.dataset.onlineActive === "true";
      if (phase === "menu") {
        if (onlineActive) dispatch({ type: "ONLINE_CANCEL" });
        return;
      }
      dispatch({ type: "SHOW_HOME_CONFIRM" });
    });
  });

  root.querySelectorAll("[data-action='start']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      dispatch({ type: "START_GAME" });
    });
  });

  root.querySelectorAll("[data-action='show-bot-modal']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      openBotModal(root, dispatch, lastBotDifficulty, (value) => {
        lastBotDifficulty = value;
        root.dataset.lastBotDifficulty = value;
      });
    });
  });

  root.querySelectorAll("[data-action='online-host']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      dispatch({ type: "ONLINE_HOST" });
    });
  });

  root.querySelectorAll("[data-action='online-join']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const input = root.querySelector("[data-room-code]");
      const code = input ? String(input.value || "").trim().toUpperCase() : "";
      if (!code) return;
      dispatch({ type: "ONLINE_JOIN", code });
    });
  });

  root.querySelectorAll("[data-action='copy-code']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const codeEl = root.querySelector(".online-code span");
      const code = codeEl ? codeEl.textContent : "";
      if (!code) return;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          const toast = root.querySelector("[data-code-toast]");
          if (!toast) return;
          if (toast._timer) {
            clearTimeout(toast._timer);
          }
          toast.classList.add("show");
          toast._timer = setTimeout(() => {
            toast.classList.remove("show");
          }, 1200);
        }).catch(() => {});
      }
    });
  });

  root.querySelectorAll("[data-action='restart']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      dispatch({ type: "RESTART" });
    });
  });

  root.querySelectorAll("[data-action='play-again']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const mode = btn.dataset.mode || "hotseat";
      const botDifficulty = btn.dataset.bot || "medium";
      if (mode === "vsBot") {
        dispatch({ type: "START_GAME", mode: "vsBot", botDifficulty });
      } else {
        dispatch({ type: "START_GAME", mode });
      }
    });
  });

  root.querySelectorAll("[data-action='back-menu']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const isOnline = btn.dataset.online === "true";
      dispatch({ type: isOnline ? "ONLINE_CANCEL" : "RESTART" });
    });
  });

  root.querySelectorAll("[data-action='home-confirm-yes']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const onlineActive = root.dataset.onlineActive === "true";
      dispatch({ type: onlineActive ? "ONLINE_CANCEL" : "RESTART" });
      dispatch({ type: "HIDE_HOME_CONFIRM" });
    });
  });

  root.querySelectorAll("[data-action='home-confirm-no']").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      dispatch({ type: "HIDE_HOME_CONFIRM" });
    });
  });

  root.querySelectorAll("[data-action='ready']").forEach((btn) => {
    const player = Number(btn.dataset.player);
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      dispatch({ type: "READY_FOR_TURN", player });
    });
  });

  root.querySelectorAll("[data-action='play']").forEach((card) => {
    const player = Number(card.dataset.player);
    const handIndex = Number(card.dataset.index);
    card.addEventListener("click", () => {
      if (root.dataset.awaitingTrick === "true") return;
      if (root.dataset.opponentDisconnected === "true") return;
      unlockSfx();
      playSfx("card");
      dispatch({ type: "PLAY_CARD", player, handIndex });
    });
  });
}

function openBotModal(root, dispatch, lastDifficulty, onSelect) {
  if (document.querySelector(".bot-modal-backdrop")) return;

  const backdrop = document.createElement("div");
  backdrop.className = "bot-modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "bot-modal";
  modal.innerHTML = `
    <h3>Choose bot difficulty</h3>
    <div class="bot-modal-actions">
      <button class="button" data-diff="easy">Easy</button>
      <button class="button" data-diff="medium">Medium</button>
      <button class="button" data-diff="hard">Hard</button>
    </div>
  `;

  const close = () => {
    backdrop.remove();
    modal.remove();
  };

  backdrop.addEventListener("click", close);
  modal.querySelectorAll("[data-diff]").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSfx();
      playSfx("button");
      const diff = btn.dataset.diff || lastDifficulty || "medium";
      onSelect(diff);
      close();
      dispatch({ type: "START_GAME", mode: "vsBot", botDifficulty: diff });
    });
  });

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
}
