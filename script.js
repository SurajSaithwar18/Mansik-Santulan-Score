
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  const form = document.getElementById("predict-form");
  const submitBtn = document.getElementById("submit-btn");
  const resetBtn = document.getElementById("reset-btn");
  const errorRetryBtn = document.getElementById("error-retry-btn");

  const stateIdle = document.getElementById("state-idle");
  const stateLoading = document.getElementById("state-loading");
  const stateResult = document.getElementById("state-result");
  const stateError = document.getElementById("state-error");

  const scoreNumberEl = document.getElementById("score-number");
  const scoreBandEl = document.getElementById("score-band");
  const scoreContextEl = document.getElementById("score-context");
  const gaugeFill = document.getElementById("gauge-fill");
  const errorCopyEl = document.getElementById("error-copy");

  const stressGroup = document.getElementById("stress_level_group");
  const stressInput = document.getElementById("stress_level");
  const GAUGE_ARC_LENGTH = 314;

  const fieldIds = {
    age: "age",
    gender: "gender",
    country: "country",
    Academic_Level: "academic_level",
    Most_Used_Platform: "most_used_platform",
    Purpose_Of_Use: "purpose_of_use",
    Avg_Daily_Usage_Hours: "avg_daily_usage_hours",
    Daily_Unlocks: "daily_unlocks",
    Study_Hours: "study_hours",
    Physical_Activity_Hours: "physical_activity_hours",
    Sleep_Hours_Per_Night: "sleep_hours_per_night",
    Stress_Level: "stress_level"
  };

  // Draw gauge tick marks.
  function drawTicks() {
    document.querySelectorAll(".gauge-ticks").forEach((group) => {
      group.innerHTML = "";

      for (let i = 0; i <= 10; i += 2) {
        const angle = Math.PI - (i / 10) * Math.PI;
        const cx = 120;
        const cy = 140;

        const line = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line"
        );

        line.setAttribute("x1", cx + 100 * Math.cos(angle));
        line.setAttribute("y1", cy - 100 * Math.sin(angle));
        line.setAttribute("x2", cx + 90 * Math.cos(angle));
        line.setAttribute("y2", cy - 90 * Math.sin(angle));

        group.appendChild(line);
      }
    });
  }

  drawTicks();

  // Stress-level buttons.
  stressGroup.querySelectorAll(".seg-btn").forEach((button) => {
    button.addEventListener("click", () => {
      stressGroup.querySelectorAll(".seg-btn").forEach((item) => {
        item.classList.remove("active");
      });

      button.classList.add("active");

      // Values must match the Literal values in main.py.
      stressInput.value = button.dataset.value;

      clearFieldError(stressInput);
    });
  });

  function setFieldError(input, message) {
    const wrapper = input.closest(".field");
    if (!wrapper) return;

    wrapper.classList.add("field-error");

    const error = wrapper.querySelector(".error-msg");
    if (error) error.textContent = message;
  }

  function clearFieldError(input) {
    const wrapper = input.closest(".field");
    if (!wrapper) return;

    wrapper.classList.remove("field-error");

    const error = wrapper.querySelector(".error-msg");
    if (error) error.textContent = "";
  }

  function clearAllErrors() {
    form.querySelectorAll(".field").forEach((field) => {
      field.classList.remove("field-error");
    });

    form.querySelectorAll(".error-msg").forEach((error) => {
      error.textContent = "";
    });
  }

  // IMPORTANT: These keys must match main.py's StudentData model.
  function collectPayload() {
    const fd = new FormData(form);

    return {
      age: Number(fd.get("age")),
      gender: fd.get("gender"),
      country: String(fd.get("country") || "").trim(),

      Academic_Level: fd.get("academic_level"),
      Most_Used_Platform: fd.get("most_used_platform"),
      Purpose_Of_Use: fd.get("purpose_of_use"),

      Avg_Daily_Usage_Hours: Number(fd.get("avg_daily_usage_hours")),
      Daily_Unlocks: Number(fd.get("daily_unlocks")),
      Study_Hours: Number(fd.get("study_hours")),
      Physical_Activity_Hours: Number(fd.get("physical_activity_hours")),
      Sleep_Hours_Per_Night: Number(fd.get("sleep_hours_per_night")),

      Stress_Level: stressInput.value
    };
  }

  function validate(payload) {
    const errors = [];

    const required = [
      ["age", "Age"],
      ["gender", "Gender"],
      ["country", "Country"],
      ["Academic_Level", "Academic level"],
      ["Most_Used_Platform", "Most-used platform"],
      ["Purpose_Of_Use", "Purpose of use"],
      ["Avg_Daily_Usage_Hours", "Daily screen time"],
      ["Daily_Unlocks", "Daily phone unlocks"],
      ["Study_Hours", "Study hours"],
      ["Physical_Activity_Hours", "Physical activity"],
      ["Sleep_Hours_Per_Night", "Sleep hours"],
      ["Stress_Level", "Stress level"]
    ];

    required.forEach(([key, label]) => {
      const value = payload[key];

      if (value === "" || value === null || value === undefined ||
          (typeof value === "number" && !Number.isFinite(value))) {
        errors.push([key, `${label} is required.`]);
      }
    });

    const numericRules = [
      ["age", 10, 100],
      ["Avg_Daily_Usage_Hours", 0, 24],
      ["Daily_Unlocks", 0, Infinity],
      ["Study_Hours", 0, 24],
      ["Physical_Activity_Hours", 0, 24],
      ["Sleep_Hours_Per_Night", 0, 24]
    ];

    numericRules.forEach(([key, min, max]) => {
      const value = payload[key];

      if (value === "" || !Number.isFinite(value)) return;

      if (value < min || value > max) {
        errors.push([
          key,
          `${key.replaceAll("_", " ")} must be between ${min} and ${
            max === Infinity ? "a valid non-negative number" : max
          }.`
        ]);
      }
    });

    const validStressLevels = ["Low", "Medium", "High", "Very High"];

    if (
      payload.Stress_Level &&
      !validStressLevels.includes(payload.Stress_Level)
    ) {
      errors.push(["Stress_Level", "Please select a valid stress level."]);
    }

    return errors;
  }

  function showState(name) {
    const states = {
      idle: stateIdle,
      loading: stateLoading,
      result: stateResult,
      error: stateError
    };

    Object.values(states).forEach((element) => {
      element.hidden = true;
    });

    states[name].hidden = false;
  }

  function renderError(message) {
    // Your original HTML has error-copy but no error-label element.
    errorCopyEl.textContent = message;
    showState("error");
  }

  function applyServerErrors(detail) {
    if (!Array.isArray(detail)) return false;

    let matched = false;

    detail.forEach((error) => {
      const location = Array.isArray(error.loc)
        ? error.loc[error.loc.length - 1]
        : null;

      const inputId = fieldIds[location];
      const input = inputId ? document.getElementById(inputId) : null;

      if (input) {
        setFieldError(input, error.msg || "Invalid value.");
        matched = true;
      }
    });

    return matched;
  }

  function bandFor(score) {
    if (score < 4) {
      return {
        label: "Signal: strained",
        context: "The model's estimate suggests possible strain. Consider your sleep, activity and screen-time habits."
      };
    }

    if (score < 7) {
      return {
        label: "Signal: balanced",
        context: "The model's estimate falls in the middle range."
      };
    }

    return {
      label: "Signal: strong",
      context: "The model's estimate falls in the upper range."
    };
  }

  function renderResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const { label, context } = bandFor(clamped);

    scoreNumberEl.textContent = score.toFixed(2);
    scoreBandEl.textContent = label;
    scoreContextEl.textContent = context;

    gaugeFill.style.transition = "none";
    gaugeFill.style.strokeDashoffset = String(GAUGE_ARC_LENGTH);

    requestAnimationFrame(() => {
      gaugeFill.style.transition = "";
      gaugeFill.style.strokeDashoffset = String(
        GAUGE_ARC_LENGTH * (1 - clamped / 10)
      );
    });

    showState("result");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAllErrors();

    const payload = collectPayload();
    const errors = validate(payload);

    if (errors.length) {
      errors.forEach(([key, message]) => {
        const inputId = fieldIds[key];
        const input = inputId
          ? document.getElementById(inputId)
          : null;

        if (input) setFieldError(input, message);
      });

      const firstInput = document.getElementById(fieldIds[errors[0][0]]);
      firstInput?.focus();
      return;
    }

    submitBtn.disabled = true;
    showState("loading");

    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const matched = applyServerErrors(data.detail);

        if (response.status === 422) {
          renderError(
            matched
              ? "Some fields were rejected by the API. Check the highlighted fields."
              : "Validation failed (422). Check the API response at http://127.0.0.1:8000/docs."
          );
        } else {
          renderError(
            typeof data.detail === "string"
              ? data.detail
              : `The server returned error ${response.status}.`
          );
        }

        return;
      }

      // Exact response field defined in your main.py.
      const score = data.predicted_mental_health_score;

      if (typeof score !== "number" || !Number.isFinite(score)) {
        renderError(
          "The API responded but did not return predicted_mental_health_score. Check the /predict response."
        );
        return;
      }

      renderResult(score);

    } catch (error) {
      console.error("Prediction request error:", error);

      renderError(
        `Cannot connect to ${API_BASE}/predict. Make sure FastAPI is running on port 8000.`
      );
    } finally {
      submitBtn.disabled = false;
    }
  });

  form.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => clearFieldError(input));
    input.addEventListener("change", () => clearFieldError(input));
  });

  function resetFormView() {
    form.reset();

    stressGroup.querySelectorAll(".seg-btn").forEach((button) => {
      button.classList.remove("active");
    });

    stressInput.value = "";
    clearAllErrors();
    showState("idle");
  }

  resetBtn.addEventListener("click", resetFormView);
  errorRetryBtn.addEventListener("click", () => showState("idle"));
})();
