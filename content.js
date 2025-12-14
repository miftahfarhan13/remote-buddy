// content.js
console.log("Remote Buddy content script loaded.");

let icon = null;
let tooltip = null;

document.addEventListener("mouseup", handleSelection);
document.addEventListener("keyup", (e) => {
  if (e.key === "Shift" || e.key === "Control" || e.key.startsWith("Arrow")) {
    handleSelection(e);
  }
});

document.addEventListener("mousedown", (e) => {
  // Hide icon if clicking elsewhere, unless clicking the icon itself
  if (icon && !icon.contains(e.target)) {
    removeIcon();
  }
  if (tooltip && !tooltip.contains(e.target)) {
    removeTooltip();
  }
});

function handleSelection(e) {
  // Capture coordinates immediately
  const isMouse = e.type === "mouseup";
  const clientX = isMouse ? e.clientX : 0;
  const clientY = isMouse ? e.clientY : 0;

  // defer slightly to let selection settle
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText.length > 0) {
      // Check if inside input/textarea
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);

      showIcon(selection, selectedText, isInput, activeElement, {
        clientX,
        clientY,
        isMouse,
      });
    } else {
      removeIcon();
    }
  }, 10);
}

function showIcon(selection, text, isInput, targetElement, coords) {
  if (icon) removeIcon();
  if (tooltip) removeTooltip();

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Validate rect - if 0s, it's invalid (common in inputs or hidden elements)
  const isRectValid = rect.width > 0 || rect.height > 0;

  if (!isRectValid && !coords?.isMouse && !isInput) {
    return; // Cannot determine position
  }

  icon = document.createElement("div");
  icon.className = "remote-buddy-icon";
  icon.innerHTML = "あA";
  icon.title = "Translate with Remote Buddy";

  // Position icon
  let top, left;

  if (isRectValid) {
    top = rect.top + window.scrollY - 30;
    left = rect.left + window.scrollX + rect.width / 2 - 12; // Center it
  } else if (coords && coords.isMouse) {
    // Fallback to mouse position
    top = coords.clientY + window.scrollY - 40;
    left = coords.clientX + window.scrollX - 12;
  } else if (targetElement) {
    // Fallback to target element (e.g. top right corner)
    const elRect = targetElement.getBoundingClientRect();
    top = elRect.top + window.scrollY - 30;
    left = elRect.left + window.scrollX + elRect.width - 20;
  } else {
    // Last resort, shouldn't happen given check above
    return;
  }

  icon.style.top = `${top}px`;
  icon.style.left = `${left}px`;

  document.body.appendChild(icon);

  icon.addEventListener("mousedown", (e) => {
    e.preventDefault(); // Prevent losing selection
    e.stopPropagation();
    console.log("Remote Buddy: Sending translation request", text);
    translateText(text, isInput, targetElement);
  });

  icon.addEventListener("mouseup", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  icon.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

function removeIcon() {
  if (icon) {
    icon.remove();
    icon = null;
  }
}

function removeTooltip() {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

function translateText(text, isInput, targetElement) {
  if (icon.dataset.isTranslating === "true") return;
  icon.dataset.isTranslating = "true";

  // Show spinner or loading state on icon
  icon.innerHTML = '<div class="remote-buddy-spinner"></div>';

  // Capture coordinates before async call in case icon is removed manually or by selection change
  const rect = icon.getBoundingClientRect();
  const savedTop = rect.top + window.scrollY;
  const savedLeft = rect.left + window.scrollX;
  const savedWidth = rect.width;
  const savedHeight = rect.height;

  chrome.runtime.sendMessage(
    { action: "translate", text: text },
    (response) => {
      console.log("Remote Buddy: Received response", response);

      if (icon) {
        icon.dataset.isTranslating = "false";
      }

      if (response && response.success) {
        if (isInput) {
          replaceInputText(response.translation, targetElement);
          removeIcon();
        } else {
          // Pass captured coordinates to showTooltip
          showTooltip(
            response.translation,
            savedTop,
            savedLeft,
            savedWidth,
            savedHeight
          );
          // Reset icon text if it still exists
          if (icon) icon.innerHTML = "あA";
        }
      } else {
        console.error(
          "Remote Buddy Translation failed:",
          response ? response.error : "Unknown error"
        );
        alert(
          `Translation failed: ${
            response ? response.error : "Check console for details"
          }`
        );
        // Reset icon instead of removing it, so user can try again
        if (icon) icon.innerHTML = "あA";
      }
    }
  );
}

function showTooltip(translatedText, iconTop, iconLeft, iconWidth, iconHeight) {
  if (tooltip) removeTooltip();

  console.log("Remote Buddy: Showing tooltip", translatedText);

  tooltip = document.createElement("div");
  tooltip.className = "remote-buddy-tooltip";
  tooltip.textContent = translatedText;

  document.body.appendChild(tooltip);

  // Adjust position after render to know height
  const tooltipRect = tooltip.getBoundingClientRect();

  // Use passed coordinates (fallback to current icon if available? No, rely on passed)
  const top = iconTop - tooltipRect.height - 10;
  const left = iconLeft - tooltipRect.width / 2 + iconWidth / 2;

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function replaceInputText(translatedText, targetElement) {
  // Handling different input types
  if (
    targetElement.tagName === "INPUT" ||
    targetElement.tagName === "TEXTAREA"
  ) {
    const start = targetElement.selectionStart;
    const end = targetElement.selectionEnd;
    const value = targetElement.value;

    targetElement.value =
      value.substring(0, start) + translatedText + value.substring(end);

    // Restore cursor? Or move to end of translation?
    targetElement.selectionStart = start + translatedText.length;
    targetElement.selectionEnd = start + translatedText.length;
  } else if (targetElement.isContentEditable) {
    // execCommand is deprecated but still widely supported for this specific case
    // Better way: Range manipulation
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(translatedText);
      range.insertNode(textNode);

      // Move cursor to end
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}
