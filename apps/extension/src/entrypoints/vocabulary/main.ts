import type { VocabularyItem } from "@contextlines/contracts";
import {
  deleteVocabularyItem,
  listVocabularyItems,
} from "../../lib/vocabulary";
import { userFacingErrorMessage } from "../../lib/user-facing-error";
import "./styles.css";

const list = document.querySelector<HTMLElement>("#list")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const settings = document.querySelector<HTMLButtonElement>("#settings")!;

settings.addEventListener("click", () => void chrome.runtime.openOptionsPage());

function emptyMessage(): string {
  return "还没有收藏。下次解释时，点一下词条旁边的“收藏”。";
}

function renderItems(items: VocabularyItem[]): void {
  list.replaceChildren();
  status.dataset.error = "false";
  if (items.length === 0) {
    status.textContent = emptyMessage();
    return;
  }
  status.textContent = `共 ${items.length} 条`;
  for (const item of items) {
    const article = document.createElement("article");
    const content = document.createElement("div");
    const heading = document.createElement("div");
    heading.className = "term-line";
    const term = document.createElement("h2");
    term.textContent = item.term;
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = item.kind === "word" ? "单词" : "短语";
    heading.append(term, kind);
    const meaning = document.createElement("p");
    meaning.textContent = item.meaning_zh;
    content.append(heading, meaning);

    const remove = document.createElement("button");
    remove.className = "remove";
    remove.type = "button";
    remove.textContent = "删除";
    remove.ariaLabel = `删除 ${item.term}`;
    remove.addEventListener("click", () => {
      if (!window.confirm(`从词单删除“${item.term}”？`)) return;
      remove.disabled = true;
      void deleteVocabularyItem(item.id)
        .then(() => {
          article.remove();
          const remaining = list.querySelectorAll("article").length;
          status.textContent = remaining
            ? `共 ${remaining} 条`
            : emptyMessage();
        })
        .catch((error: unknown) => {
          remove.disabled = false;
          status.dataset.error = "true";
          status.textContent = userFacingErrorMessage(
            error,
            "没有成功删除，请稍后重试。",
          );
        });
    });
    article.append(content, remove);
    list.append(article);
  }
}

void listVocabularyItems()
  .then(renderItems)
  .catch((error: unknown) => {
    status.dataset.error = "true";
    status.textContent = userFacingErrorMessage(
      error,
      "没有成功读取词单，请稍后重试。",
    );
  });
