window.filters = {
  location: [],
  casket: [],
  tentage: [],
  catering: [],
  hearse: [],
  personnel: [],
  monks: [],
  days: [],
  priceMin: null,
  priceMax: null,
  searchTerm: "",
  sortBy: "",
  priceBand: [],
};

let funeralData = [];
let lastFraction = 0;
let lastMaxFraction = 1;
let isPriceDragging = false;

function initializePage() {
  
  const requiredElements = [
    "funeral-cards-container",
    "price-band-bar",
    "price-min",
    "price-max"
  ];
  
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  if (missingElements.length > 0) {
    console.error("❌ Missing required elements:", missingElements);
    return;
  }

  setTimeout(function () {
    setupFilters();
    getFiltersFromURL();
    updateSelectedFilters();
    
    const sortOptions = [
      "price-asc", "price-desc",
      "google-rating-desc", "facebook-rating-desc",
      "google-reviews-desc", "facebook-reviews-desc"
    ];
    sortOptions.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          filters.sortBy = id;
          console.log("🔁 Sort By Set To:", id);
          applyFilters();
        });
      }
    });

    fetchFuneralData();
  }, 1500);
}

document.addEventListener("DOMContentLoaded", initializePage);

async function fetchFuneralData() {
  const jsonUrl = "https://raw.githubusercontent.com/Marcellolepoe/pgdata/main/cleaned_buddhist_funeral_directory.json";
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error("Failed to fetch data.");
    funeralData = await response.json();
    console.log(`✅ Loaded ${funeralData.length} funeral packages.`);
    window.funeralData = funeralData;
    
    const allCountEl = document.getElementById("all-results");
  	if (allCountEl) allCountEl.textContent = funeralData.length;

    const priceKeys = [
      "Available Duration (1 Day)",
      "Available Duration (2 Day)",
      "Available Duration (3 Days)",
      "Available Duration (4 Days)",
      "Available Duration (5 Days)",
      "Available Duration (6 Days)",
      "Available Duration (7 Days)"
    ];

    const allPrices = funeralData.flatMap(pkg => {
      return priceKeys.map(key => {
        return parseFloat((pkg[key] || "").toString().replace(/[^\d.]/g, ""));
      });
    }).filter(p => !isNaN(p) && p > 0);
    
    window.globalMinPrice = Math.min(...allPrices);  // Should be 988 if present
    window.globalMaxPrice = Math.max(...allPrices);  // E.g., 31610
    
    console.log("Global Prices:", {globalMin: window.globalMinPrice, globalMax: window.globalMaxPrice});
    
    window.sliderMapping = getFullPricingStats();
    
    filters.priceMin = window.globalMinPrice;
    filters.priceMax = window.globalMaxPrice;
    filters.sortBy = "";
    
    setupPriceSliderDiv();
    
    applyFilters();
    getFiltersFromURL();
  } catch (error) {
    console.error("❌ Error fetching funeral data:", error);
  }
  
}

window.onload = async function () {
  await fetchFuneralData();
};

function valueToPercent(v, minVal, p33, p66, maxVal) {
  if (v <= p33) {
    return ((v - minVal) / (p33 - minVal)) * 33;           // 0→33%
  } else if (v <= p66) {
    return 33 + ((v - p33) / (p66 - p33)) * 33;             // 33→66%
  } else {
    return 66 + ((v - p66) / (maxVal - p66)) * 34;          // 66→100%
  }
}

function getFullPricingStats() {
  const priceKeys = [
    "Available Duration (1 Day)",
    "Available Duration (2 Day)",
    "Available Duration (3 Days)",
    "Available Duration (4 Days)",
    "Available Duration (5 Days)",
    "Available Duration (6 Days)",
    "Available Duration (7 Days)"
  ];
  const allPrices = funeralData.flatMap(pkg => {
    return priceKeys.map(key => {
      return parseFloat((pkg[key] || "").toString().replace(/[^\d.]/g, ""));
    });
  }).filter(p => !isNaN(p) && p > 0);
  const sorted = allPrices.sort((a, b) => a - b);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    p33: sorted[Math.floor(sorted.length * 0.33)],
    p66: sorted[Math.floor(sorted.length * 0.66)],
    max: sorted[sorted.length - 1]
  };
}

function piecewisePercentileToValue(fraction, minVal, p33, p66, maxVal) {
  if (fraction <= 0.33) {
    const localFrac = fraction / 0.33;
    return minVal + localFrac * (p33 - minVal);
  } else if (fraction <= 0.66) {
    const localFrac = (fraction - 0.33) / 0.33;
    return p33 + localFrac * (p66 - p33);
  } else {
    const localFrac = (fraction - 0.66) / 0.34; // (1 - 0.66 = 0.34)
    return p66 + localFrac * (maxVal - p66);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("funeral-parlour-search");
  if (searchInput) {
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
    searchInput.addEventListener("input", function () {
      filters.searchTerm = this.value.trim().toLowerCase();
      updateSelectedFilters();
      applyFilters();
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const manualMaxInput = document.getElementById("price-input-max");
  if (manualMaxInput) {
    manualMaxInput.addEventListener("input", () => {
      const val = parseInt(manualMaxInput.value.replace(/[^\d]/g, ""), 10);
      if (!isNaN(val) && val > 0) {
        filters.priceMin = window.globalMinPrice;
        filters.priceMax = val;
        const minValue = window.globalMinPrice;
        const maxValue = window.globalMaxPrice;
        const maxThumb = document.getElementById("price-max");

        let percentMax = ((val - minValue) / (maxValue - minValue)) * 100;
        percentMax = Math.max(0, Math.min(100, percentMax));

        maxThumb.style.left = `${percentMax}%`;
    
        updateSelectedFilters();
        applyFilters();
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const sortOptions = ["price-asc", "price-desc", "google-rating-desc", "facebook-rating-desc", "google-reviews-desc", "facebook-reviews-desc"];
  sortOptions.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        filters.sortBy = id;
        const labelMap = {
          "price-asc": "Price ↑",
          "price-desc": "Price ↓",
          "google-rating-desc": "Google Reviews",
          "facebook-rating-desc": "Facebook Reviews",
          "google-reviews-desc": " #Google Reviews",
          "facebook-reviews-desc": "# FB Reviews"
        };
        const sortLabel = document.getElementById("sort-button-label");
        if (sortLabel) sortLabel.textContent = labelMap[id] || "Sort By";
        applyFilters();
      });
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const clearAllButton = document.getElementById("clear-all");
  if (clearAllButton) {
    clearAllButton.addEventListener("click", function () {
      console.log("🧹 Clearing all filters...");
      Object.keys(filters).forEach(category => {
        if (Array.isArray(filters[category])) {
          filters[category] = [];
        } else if (category === "priceMin") {
          filters.priceMin = window.globalMinPrice;
        } else if (category === "priceMax") {
          filters.priceMax = window.globalMaxPrice;
        } else if (category === "searchTerm") {
          filters.searchTerm = "";
        }
      });
      if (typeof window.resetPriceSlider === "function") resetPriceSlider();
      const manualMaxInput = document.getElementById("price-input-max");
      if (manualMaxInput) manualMaxInput.value = "";
      const searchInput = document.getElementById("funeral-parlour-search");
      if (searchInput) searchInput.value = "";
      document.querySelectorAll('.filter-checkbox input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
      });
      filters.sortBy = "";
      const sortLabel = document.getElementById("sort-button-label");
      if (sortLabel) {
        sortLabel.textContent = "Sort By";
      }
      updateSelectedFilters();
      applyFilters();
    });
  } else {
    console.error("🚨 Clear All button not found! Check Webflow class name and ID.");
  }
});

function setupFilters() {
  document.querySelectorAll(".filter-checkbox input[type='checkbox']").forEach(checkbox => {
    const label = checkbox.closest(".filter-checkbox");
    if (!label) return;
    const category = label.dataset.category;
    const value = label.dataset.value;
    if (!category || !value) {
      console.warn("⚠️ Checkbox missing data-category or data-value:", checkbox);
      return;
    }
    checkbox.addEventListener("change", function () {
      console.log(`🔍 Filter changed: ${category} = ${value} (${this.checked ? "checked" : "unchecked"})`);
      if (this.checked) {
        if (!filters[category].includes(value)) {
          filters[category].push(value);
        }
      } else {
        filters[category] = filters[category].filter(v => v !== value);
      }
      updateSelectedFilters();
      applyFilters();
      
      const nonPriceFiltered = getFilteredDataExcludingPrice();
      updatePricingBands(nonPriceFiltered, false);
    });
  });
  console.log("✅ Filters set up successfully.");
}

// GET FILTERS FROM URL
function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  Object.keys(filters).forEach(category => {
    if (category === "priceMin") {
      const val = parseFloat(params.get("priceMin"));
      filters.priceMin = isNaN(val) ? window.globalMinPrice : val;
    } else if (category === "priceMax") {
      const val = parseFloat(params.get("priceMax"));
      filters.priceMax = isNaN(val) ? window.globalMaxPrice : val;
    } else if (category === "searchTerm" || category === "sortBy") {
      filters[category] = params.get(category) || "";
    } else {
      let urlFilters = params.get(category) ? params.get(category).split(",") : [];
      filters[category] = urlFilters.filter(value => value.trim() !== "");
      filters.priceBand = params.get("priceBand") ? params.get("priceBand").split(",") : [];
    }
  });
  console.log("✅ Filters Loaded from URL:", filters);
  document.querySelectorAll(".filter-checkbox input[type='checkbox']").forEach(checkbox => {
    let category = checkbox.closest(".filter-checkbox")?.dataset.category;
    let selectedValue = checkbox.dataset.value;
    if (filters[category] && filters[category].includes(selectedValue)) {
      checkbox.checked = true;
    } else {
      checkbox.checked = false;
    }
  });
  updateSelectedFilters();
  applyFilters();
}

// UPDATE URL PARAMETERS
function updateURLParams() {
  const params = new URLSearchParams();
  Object.keys(filters).forEach(category => {
    const val = filters[category];
    if (filters.priceBand.length)
 			 params.set("priceBand", filters.priceBand.join(","));
    if (Array.isArray(val) && val.length > 0) {
      params.set(category, val.join(","));
    } else if (typeof val === "string" && val.trim() !== "") {
      params.set(category, val.trim());
    }
  });
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", newUrl);
}

// Update Selected Filters Panel
function updateSelectedFilters() {
  console.log("🔔 updateSelectedFilters()", filters.priceMin, filters.priceMax);
  const selectedFiltersDiv = document.getElementById("selected-filters");
  if (!selectedFiltersDiv) return;
  selectedFiltersDiv.innerHTML = "";

  let hasFilters = false;
  let tagCount = 0;
  Object.keys(filters).forEach((category) => {
    const val = filters[category];
    const isArray = Array.isArray(val) && val.length > 0;
    const isPrice = category === "priceMin";
    const isSearch = category === "searchTerm" && typeof val === "string" && val.trim().length > 0;
    const isSort = category === "sortBy" && val;

    if (category === "priceBand" && Array.isArray(val) && val.length > 0) {
      const pretty = { lower: "Lower", middle: "Middle", upper: "Upper" };
      const labels = val.map((v) => pretty[v]).join(", ");
      if (tagCount > 0) {
        const separator = document.createElement("span");
        separator.classList.add("filter-separator");
        separator.innerHTML = " | ";
        selectedFiltersDiv.appendChild(separator);
      }
      const el = document.createElement("span");
      el.classList.add("filter-tag");
      el.innerHTML = `
        <strong>Price Band:</strong> ${labels}
        <button class="clear-category" data-category="priceBand">✕</button>
      `;
      selectedFiltersDiv.appendChild(el);
      tagCount++;
      return;
    }

    if (isSearch || isPrice || isArray || isSort) {
      hasFilters = true;
      if (tagCount > 0) {
        const separator = document.createElement("span");
        separator.classList.add("filter-separator");
        separator.innerHTML = " | ";
        selectedFiltersDiv.appendChild(separator);
      }
      const filterTag = document.createElement("span");
      filterTag.classList.add("filter-tag");
      if (isSearch) {
        filterTag.innerHTML = `<strong>Parlour:</strong> ${val}
          <button class="clear-category" data-category="searchTerm">✕</button>`;
      } else if (isPrice && typeof filters.priceMin === "number" && typeof filters.priceMax === "number") {
        const manualMaxInput = document.getElementById("price-input-max");
        const manualMaxEntered = manualMaxInput && manualMaxInput.value && filters.priceMax !== window.globalMaxPrice;
        if (manualMaxEntered || filters.priceMin > window.globalMinPrice || filters.priceMax < window.globalMaxPrice) {
          const label = manualMaxEntered
            ? `$${filters.priceMax.toLocaleString()} Max`
            : `$${filters.priceMin.toLocaleString()} – $${filters.priceMax.toLocaleString()}`;
          filterTag.innerHTML = `<strong>Price:</strong> ${label}
            <button class="clear-category" data-category="price">✕</button>`;
        } else {
          return; // Price is default, so do not render.
        }
      } else if (isArray) {
        const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
        const label = val.join(", ");
        filterTag.innerHTML = `<strong>${formattedCategory}:</strong> ${label}
          <button class="clear-category" data-category="${category}">✕</button>`;
      } else if (isSort) {
        const labelMap = {
          "price-asc": "Price ↑",
          "price-desc": "Price ↓",
          "google-rating-desc": "Google ★",
          "facebook-rating-desc": "Facebook ★",
          "google-reviews-desc": "Google Reviews",
          "facebook-reviews-desc": "Facebook Reviews"
        };
        const label = labelMap[val] || val;
        filterTag.innerHTML = `<strong>Sort:</strong> ${label}
          <button class="clear-category" data-category="sortBy">✕</button>`;
      }
      selectedFiltersDiv.appendChild(filterTag);
      tagCount++;
    }
  });
  if (!hasFilters) {
    selectedFiltersDiv.innerHTML = `<p style="color: gray;">No filters selected.</p>`;
  }
  // Remove any trailing separator
  const children = Array.from(selectedFiltersDiv.children);
  if (children.length > 0 && children[children.length - 1].classList.contains('filter-separator')) {
    selectedFiltersDiv.removeChild(children[children.length - 1]);
  }
  selectedFiltersDiv.querySelectorAll(".clear-category").forEach(function (button) {
    button.addEventListener("click", function () {
      const category = this.dataset.category;
      if (this.dataset.category === "price") {
        filters.priceMin = window.globalMinPrice;
        filters.priceMax = window.globalMaxPrice;
        resetPriceSlider();
        const manualMaxInput = document.getElementById("price-input-max");
        if (manualMaxInput) manualMaxInput.value = "";
      } else if (category === "searchTerm") {
        filters.searchTerm = "";
        const searchInput = document.getElementById("funeral-parlour-search");
        if (searchInput) searchInput.value = "";
      } else if (category === "sortBy") {
        filters.sortBy = "";
      } else {
        filters[category] = [];
        document.querySelectorAll(`.filter-checkbox[data-category="${category}"] input[type="checkbox"]`)
          .forEach(checkbox => checkbox.checked = false);
      } if (category === "priceBand") {
        filters.priceBand = [];
        document.querySelectorAll('[data-category="priceBand"] input')
          .forEach(cb => cb.checked = false);
      }
      updateSelectedFilters();
      applyFilters();
    });
  });

  updateURLParams();
}


// Reset Price Slider (Full Range)
function resetPriceSlider() {
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  if (minThumb && maxThumb) {
    minThumb.style.left = "0%";
    maxThumb.style.left = "100%";
  }
  filters.priceMin = window.globalMinPrice;
  filters.priceMax = window.globalMaxPrice;
  console.log("🔁 Price slider reset to full range.");
}

// HELPER: getDisplayValue
function getDisplayValue(field) {
  if (!field) return "Not Available";
  if (typeof field === "object" && "display" in field) return field.display || "Not Available";
  if (typeof field === "string") return field;
  return "Not Available";
}

// INCLUSION FIELD MAPPING
const inclusionFieldMapping = {
  Casket: {
    display: "Casket (Display Description)",
    filter: "Casket (Filter Label)"
  },
  Catering: {
    display: "Catering (Display Description)",
    filter: "Catering (Filter Label)"
  },
  Tentage: {
    display: "Tentage (Display Description)",
    filter: "Tentage (Filter Label)"
  },
  Hearse: {
    display: "Hearse (Display Description)",
    filter: "Hearse (Filter Label)"
  },
  Personnel: {
    display: "Personnel (Display Description)",
    filter: "Personnel (Filter Label)"
  },
  Monks: {
    display: "Monks (Display Description)",
    filter: "Monks (Filter Label)"
  }
};

// HELPER: getInclusionValue
function getInclusionValue(funeral, key) {
  const mapping = inclusionFieldMapping[key];
  if (!mapping) return "Not Available";
  const value = funeral[mapping.display];
  return value && value.toString().trim() !== "" ? value : "Not Available";
}

// GET ICON FOR CATEGORIES
function getIconForKey(key) {
  const iconMap = {
    Casket: "coffin.png",
    Catering: "cloche.png",
    Tentage: "event-tent.png",
    Hearse: "hearse.png",
    Personnel: "service.png",
    Monks: "monk.png"
  };
  return iconMap[key] || "default.png";
}

// FORMAT AVAILABLE PRICES
function formatAvailablePrices(funeral, selectedDays = []) {
  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)",
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };
  if (!selectedDays || selectedDays.length === 0) {
    selectedDays = Object.keys(dayMap);
  }
  const priceRows = selectedDays.map(day => {
    const key = dayMap[day];
    const price = funeral[key];
    if (price && !isNaN(parseFloat(price))) {
      return `<p class="pricing-text">${day} Day: <span class="price">$${parseFloat(price).toLocaleString()}</span></p>`;
    }
    return `<p class="pricing-text">${day} Day: <span class="unavailable">N/A</span></p>`;
  });
  return priceRows.join("");
}

// RENDER SINGLE CARD
function renderSingleCardHTML(funeral) {
  return `
    <div class="card-content">
      <h3 class="funeral-name">${funeral["Funeral Parlour Name"] || "Not Available"}</h3>
      <p>Phone: ${funeral["Contact Number"] || "NA"}</p>
      <p>Package: <strong>${funeral["Package Name"] || "Unknown"}</strong></p>
    </div>
  `;
}

// ADJUST CAROUSEL HEIGHT
function adjustCarouselHeight(wrapper) {
  const activeCard = wrapper.querySelector('.carousel-card.active');
  if (activeCard) {
    const height = activeCard.offsetHeight;
    wrapper.style.height = `${height}px`;
  }
}

// CREATE FUNERAL CARD (Webflow population version)
function populateFuneralCard(cardWrapper, funeral) {
  console.log("🟢 Webflow card population code is running");
  if (!cardWrapper || !funeral) {
    console.error("❌ populateFuneralCard called with missing arguments");
    return;
  }

  // Name
  const nameEl = cardWrapper.querySelector('.funeral-parlour-name');
  if (nameEl) nameEl.textContent = funeral["Funeral Parlour Name"] || "Not Available";

  // Phone
  const phoneEl = cardWrapper.querySelector('.parlour-phone-number');
  if (phoneEl) phoneEl.textContent = funeral["Contact Number"] || "Not Available";

  // Founded In (Years of Service)
  const foundedInEl = cardWrapper.querySelector('.founded-in');
  if (foundedInEl) {
    if (funeral["Years of Service"] && funeral["Years of Service"].toString().trim() !== "") {
      foundedInEl.textContent = funeral["Years of Service"];
      foundedInEl.parentElement.style.display = '';
    } else {
      foundedInEl.parentElement.style.display = 'none';
    }
  }

  // Google Review Score (score and number)
  const googleScoreEl = cardWrapper.querySelector('.google-review-score');
  if (googleScoreEl) googleScoreEl.textContent = funeral["Google Rating"] || "-";
  const googleReviewNumberEl = cardWrapper.querySelector('.google-review-number');
  if (googleReviewNumberEl) googleReviewNumberEl.textContent = funeral["Google Reviews"] || "0";

  // Facebook Review Score (if you have it)
  const fbScoreEl = cardWrapper.querySelector('.fb-review-score');
  if (fbScoreEl) fbScoreEl.textContent = funeral["Facebook Rating"] || "-";
  const fbReviewNumberEl = cardWrapper.querySelector('.fb-number-reviews');
  if (fbReviewNumberEl) fbReviewNumberEl.textContent = funeral["Facebook Reviews"] || "0";

  // Google Stars (set on google-stars-div)
  const googleStarsDiv = cardWrapper.querySelector('#google-stars-div, .google-stars-div');
  const googleRating = parseFloat(funeral["Google Rating"]);
  console.log('Google rating:', googleRating, 'Element:', googleStarsDiv);
  if (googleStarsDiv) {
    if (!isNaN(googleRating) && googleRating > 0) {
      googleStarsDiv.innerHTML = renderStars(googleRating);
      googleStarsDiv.style.display = '';
      console.log('Google stars HTML:', googleStarsDiv.innerHTML);
    } else {
      googleStarsDiv.style.display = 'none';
      console.log('No Google rating, hiding stars.');
    }
  }

  // Facebook Stars (set on fb-stars-div)
  const fbStarsDiv = cardWrapper.querySelector('#fb-stars-div, .fb-stars-div');
  const fbRating = parseFloat(funeral["Facebook Rating"]);
  console.log('FB rating:', fbRating, 'Element:', fbStarsDiv);
  if (fbStarsDiv) {
    if (!isNaN(fbRating) && fbRating > 0) {
      fbStarsDiv.innerHTML = renderStars(fbRating);
      fbStarsDiv.style.display = '';
      console.log('FB stars HTML:', fbStarsDiv.innerHTML);
    } else {
      fbStarsDiv.style.display = 'none';
      console.log('No FB rating, hiding stars.');
    }
  }

  // Review Excerpt
  const excerptEl = cardWrapper.querySelector('.review-excerpt');
  const excerptDiv = cardWrapper.querySelector('#review-excerpt-div-1');
  if (excerptEl && excerptDiv) {
    if (funeral["Review Excerpt"] && funeral["Review Excerpt"].toString().trim() !== "") {
      excerptEl.textContent = funeral["Review Excerpt"];
      excerptDiv.style.display = '';
    } else {
      excerptDiv.style.display = 'none';
    }
  }

  // Day Prices (1-7) with day filter logic
  const selectedDays = Array.isArray(filters?.days) && filters.days.length > 0
    ? filters.days.map(Number)
    : [1,2,3,4,5,6,7];
  console.log('Selected days for pricing:', selectedDays);
  for (let i = 1; i <= 7; i++) {
    const priceKey = `Available Duration (${i} Day${i > 1 ? (i === 2 ? '' : 's') : ''})`;
    const priceEl = cardWrapper.querySelector(`#day${i}-price`);
    const priceDiv = cardWrapper.querySelector(`#day${i}-price-div`);
    let priceVal = funeral[priceKey];
    let cleanPrice = priceVal ? priceVal.toString().replace(/[^\d.]/g, "") : "";
    let priceNum = parseFloat(cleanPrice);
    if (priceEl && priceDiv) {
      if (selectedDays.includes(i)) {
        if (!isNaN(priceNum)) {
          priceEl.textContent = `$${priceNum.toLocaleString()}`;
          priceDiv.style.display = '';
        } else {
          priceDiv.style.display = 'none';
        }
      } else {
        priceDiv.style.display = 'none';
      }
    }
  }

  // Inclusions (casket, catering, tentage, hearse, personnel, monks)
  const inclusions = [
    { key: 'Casket (Display Description)', class: 'casket-description', div: '#casket-div' },
    { key: 'Catering (Display Description)', class: 'catering-description', div: '#catering-div' },
    { key: 'Tentage (Display Description)', class: 'tentage-description', div: '#tentage-div' },
    { key: 'Hearse (Display Description)', class: 'hearse-description', div: '#hearse-div' },
    { key: 'Personnel (Display Description)', class: 'personnel-description', div: '#personnel-div' },
    { key: 'Monks (Display Description)', class: 'monk-description', div: '#monks-div' }
  ];
  inclusions.forEach(({ key, class: descClass, div }) => {
    const descEl = cardWrapper.querySelector(`#${descClass}`);
    const parentDiv = cardWrapper.querySelector(div);
    if (descEl && parentDiv) {
      if (funeral[key] && funeral[key].toString().trim() !== "") {
        descEl.textContent = funeral[key];
        parentDiv.style.display = '';
      } else {
        parentDiv.style.display = 'none';
      }
    }
  });

  // Link button to website (Parlour Website Link)
  const linkButton = cardWrapper.querySelector('#link-button, .link-button');
  if (linkButton && funeral["Parlour Website Link"] && funeral["Parlour Website Link"].trim() !== "") {
    linkButton.setAttribute('href', funeral["Parlour Website Link"]);
    linkButton.setAttribute('target', '_blank');
    linkButton.setAttribute('rel', 'noopener noreferrer');
    linkButton.style.display = '';
  } else if (linkButton) {
    linkButton.style.display = 'none';
  }
}

// Helper to render stars (full stars only, round to nearest, max 5)
function renderStars(rating) {
  const fullStarURL = "https://cdn.prod.website-files.com/66343534ea61f97f0e1a4dd7/66423ee2f290eb7af2024d7f_Untitled%20design%20(4).png";
  const rounded = Math.round(rating);
  let stars = "";
  for (let i = 0; i < Math.min(rounded, 5); i++) {
    stars += `<img src="${fullStarURL}" alt="Star" width="16" height="16" />`;
  }
  return stars;
}

// ADJUST CAROUSEL HEIGHT
function adjustCarouselHeight(wrapper) {
  const activeCard = wrapper.querySelector('.carousel-card.active');
  if (activeCard) {
    const height = activeCard.offsetHeight;
    wrapper.style.height = `${height}px`;
  }
}

// RENDER RESULTS (Webflow population version)
function renderResults(filteredData) {
  const container = document.getElementById("funeral-cards-container");
  const template = document.getElementById("funeral-card-wrapper");
  if (!container || !template) {
    return;
  }
  // Remove all previously rendered cards except the template
  Array.from(container.children).forEach(child => {
    if (child !== template) container.removeChild(child);
  });
  template.style.display = "none";
  // Use document fragment for batch DOM updates
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < filteredData.length; i++) {
    const data = filteredData[i];
    const card = template.cloneNode(true);
    card.id = "";
    card.style.display = "";
    populateFuneralCard(card, data);
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}

// HELPER: renderIconRow
function renderIconRow(label, value) {
  const iconMap = {
    "Casket": "coffin.png",
    "Catering": "cloche.png",
    "Tentage": "event-tent.png",
    "Hearse": "cloche.png",
    "Personnel": "service.png",
    "Monks": "monk.png"
  };
  const iconUrl = `https://cdn.prod.website-files.com/66343534ea61f97f0e1a4dd7/665d64da881d26148b9693fb_${iconMap[label] || "default.png"}`;
  return `
    <div class="div-block-194">
      <img src="${iconUrl}" width="20" height="20" alt="">
      <div>${label}</div>
      <div>${value || "—"}</div>
    </div>
  `;
}

// HELPER: getStarIcons
function getStarIcons(rating) {
  const fullStarURL = "https://cdn.prod.website-files.com/66343534ea61f97f0e1a4dd7/66423ee2f290eb7af2024d7f_Untitled%20design%20(4).png";
  const rounded = Math.floor(rating);
  let stars = "";
  for (let i = 0; i < rounded && i < 5; i++) {
    stars += `<img src="${fullStarURL}" alt="Star" width="16" height="16" />`;
  }
  return stars;
}

// FILTER KEY MAP
const filterKeyMap = {
  casket: "Casket (Filter Label)",
  tentage: "Tentage (Filter Label)",
  catering: "Catering (Filter Label)",
  hearse: "Hearse (Filter Label)",
  personnel: "Personnel (Filter Label)",
  monks: "Monks (Filter Label)",
  location: "Location",
  days: null
};

// UPDATE TEXT FOR ALL (Price Band Logic)
function updateTextForAll(selector, value) {
  document.querySelectorAll(selector).forEach(span => {
    span.innerText = Number(value).toLocaleString();
  });
}

// UPDATE VISUAL PRICE BANDS (always 1/3 each)
function updatePriceBandsVisual(min, lower, upper, max) {
  const lowerDiv = document.getElementById("band-lower");
  const middleDiv = document.getElementById("band-middle");
  const upperDiv = document.getElementById("band-upper");
  if (!lowerDiv || !middleDiv || !upperDiv) return;
  lowerDiv.style.width = "33.3333%";
  middleDiv.style.left = "33.3333%";
  middleDiv.style.width = "33.3333%";
  upperDiv.style.left = "66.6666%";
  upperDiv.style.width = "33.3333%";
}

// UPDATE BAND WIDTHS (if needed)
function updateBandWidths(minPrice, lowerBand, upperBand, maxPrice) {
  const total = maxPrice - minPrice;
  const percent = val => ((val - minPrice) / total) * 100;
  const lower = document.getElementById("band-lower");
  const middle = document.getElementById("band-middle");
  const upper = document.getElementById("band-upper");
  if (!lower || !middle || !upper) {
    console.warn("💥 Missing band elements in DOM.");
    return;
  }
  const lowerWidth = percent(lowerBand);
  const middleWidth = percent(upperBand) - lowerWidth;
  const upperWidth = 100 - lowerWidth - middleWidth;
  lower.style.width = `${lowerWidth}%`;
  middle.style.left = `${lowerWidth}%`;
  middle.style.width = `${middleWidth}%`;
  upper.style.left = `${lowerWidth + middleWidth}%`;
  upper.style.width = `${upperWidth}%`;
}

// UPDATE PRICING BANDS
function updatePricingBands(filteredData, skipFilterReset = false) {
console.log("🔧 updatePricingBands()", "skipFilterReset=", skipFilterReset, "filters before band‑reset:", JSON.stringify(filters));
  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)",
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };
  // If you only selected one day, only look at that column:
  let priceKeys;
  if (Array.isArray(filters.days) && filters.days.length === 1) {
    priceKeys = [ dayMap[filters.days[0]] ];
  } else {
    priceKeys = Object.values(dayMap);
  }

  const prices = filteredData
    .flatMap(item =>
      priceKeys.map(k =>
        parseFloat((item[k] || "").toString().replace(/[^\d.]/g, ""))
      )
    )
    .filter(p => !isNaN(p));
  if (prices.length === 0) return;

  const sorted      = prices.sort((a, b) => a - b);
  const filteredMin = sorted[0];
  const filteredMax = sorted[sorted.length - 1];
  const median      = sorted[Math.floor(sorted.length / 2)];
  const lowerBand   = Math.round(sorted[Math.floor(sorted.length * 0.33)]);
  const upperBand   = Math.round(sorted[Math.floor(sorted.length * 0.66)]);

  // Update the numeric displays:
  updateTextForAll(".lowest-price-display",  filteredMin);
  updateTextForAll(".lower-band-range",     lowerBand);
  updateTextForAll(".median-price-display", median);
  updateTextForAll(".upper-band-range",     upperBand);
  updateTextForAll(".highest-price-display",filteredMax);

  // Update the colored bands visually:
  updatePriceBandsVisual(filteredMin, lowerBand, upperBand, filteredMax);

  // Save for the slider logic:
  window.sliderMapping = { min: filteredMin, p33: lowerBand, p66: upperBand, max: filteredMax };

  // **Only** overwrite the filters & reset thumbs when skipFilterReset===false
  if (!skipFilterReset) {
    filters.priceMin = filteredMin;
    filters.priceMax = filteredMax;
    positionThumbs(filteredMin, filteredMax, filteredMin, filteredMax);
  } else {
    // leave filters.priceMin/max alone, but still reposition thumbs
    positionThumbs(filteredMin, filteredMax, filters.priceMin, filters.priceMax);
  }
}

// POSITION THUMBS
function positionThumbs(filteredMin, filteredMax, selectedMin, selectedMax) {
  // if sliderMapping is undefined, grab the full stats
  const stats = window.sliderMapping || getFullPricingStats();
  const { min, p33, p66, max } = stats;

  // now clamp your selectedMin/selectedMax
  selectedMin = Math.max(filteredMin, Math.min(selectedMin, filteredMax));
  selectedMax = Math.max(filteredMin, Math.min(selectedMax, filteredMax));

  // inverse‐map value → percent
  const pctMin = valueToPercent(selectedMin, min, p33, p66, max);
  const pctMax = valueToPercent(selectedMax, min, p33, p66, max);

  document.getElementById("price-min").style.left = pctMin + "%";
  document.getElementById("price-max").style.left = pctMax + "%";
}

// APPLY FILTERS
function applyFilters(skipBandReset = false) {
  console.log("🔍 applyFilters() called with filters:", filters);
  console.log("📊 Initial data count:", funeralData?.length || 0);

  // ─── 1) SETUP ────────────────────────────────────────────────────────────────
  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)",
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };
  const selectedDays = filters.days.length ? filters.days : Object.keys(dayMap);
  const term = filters.searchTerm.trim().toLowerCase();

  // ─── 2) NON‑PRICE FILTERING ─────────────────────────────────────────────────
  //    (search term + all your checkbox/days filters)
  const filteredDataForBands = funeralData.filter(item => {
    // 2a) Parlour name search
    if (term) {
      const name = (item["Funeral Parlour Name"] || "").toLowerCase();
      if (!name.includes(term)) return false;
    }
    // 2b) other array filters (except priceMin/Max, sortBy, priceBand)
    for (const category in filters) {
      const vals = filters[category];
      if (!Array.isArray(vals) || vals.length === 0) continue;
      if (["priceMin","priceMax","sortBy","priceBand"].includes(category)) continue;

      if (category === "days") {
        // require at least one valid day price
        const ok = selectedDays.some(d => {
          const raw = item[ dayMap[d] ] || "";
          const p = parseFloat(raw.toString().replace(/[^\d.]/g,""));
          return !isNaN(p);
        });
        if (!ok) return false;
      } else {
        const field = filterKeyMap[category];
        const val   = (item[field] || "").toString().toLowerCase();
        if (!vals.some(v => val.includes(v.toLowerCase()))) return false;
      }
    }
    return true;
  });

  // After non-price filtering
  console.log("📊 After non-price filtering:", filteredDataForBands?.length || 0, "items");

  // ─── 3) PRICE‑BAND vs MANUAL SLIDER ─────────────────────────────────────────
  const stats            = window.sliderMapping || getFullPricingStats();
  const bandRanges       = (filters.priceBand||[]).map(b => {
    if (b === "lower")  return [stats.min, stats.p33];
    if (b === "middle") return [stats.p33, stats.p66];
    if (b === "upper")  return [stats.p66, stats.max];
  });
  const priceBandActive   = bandRanges.length > 0;
  const priceFilterActive = !priceBandActive
    && (filters.priceMin !== window.globalMinPrice
     || filters.priceMax !== window.globalMaxPrice);

  // ─── 3a) SNAP THUMBS INTO BAND RANGE ONCE ──────────────────────────────────
  if (priceBandActive && !isPriceDragging) {
    const newMin = Math.min(...bandRanges.map(([lo,hi]) => lo));
    const newMax = Math.max(...bandRanges.map(([lo,hi]) => hi));
    filters.priceMin = newMin;
    filters.priceMax = newMax;
    positionThumbs(stats.min, stats.max, newMin, newMax);
  }

  // ─── 4) UPDATE THE COLORED BANDS VISUALS ───────────────────────────────────
  if (!isPriceDragging) {
    // pass skipReset = priceBandActive so we don't stomp our thumb snap
    updatePricingBands(filteredDataForBands, priceBandActive);
  }

  // ─── 5) FINAL PRICE FILTERING ──────────────────────────────────────────────
  const filteredDataWithPrice = filteredDataForBands.filter(item => {
    if (priceBandActive) {
      // include any package in any selected band
      return Object.keys(dayMap).some(d => {
        const raw = item[dayMap[d]] || "";
        const p   = parseFloat(raw.toString().replace(/[^\d.]/g,""));
        return bandRanges.some(([lo,hi]) => p >= lo && p <= hi);
      });
    }
    if (priceFilterActive) {
      // manual slider
      return Object.keys(dayMap).some(d => {
        const raw = item[dayMap[d]] || "";
        const p   = parseFloat(raw.toString().replace(/[^\d.]/g,""));
        return !isNaN(p) && p >= filters.priceMin && p <= filters.priceMax;
      });
    }
    return true;
  });

  // After price filtering
  console.log("📊 After price filtering:", filteredDataWithPrice?.length || 0, "items");

  // ─── 6) UPDATE COUNTERS ───────────────────────────────────────────────────
  const allEl  = document.getElementById("all-results");
  const showEl = document.getElementById("showed-results");
  if (allEl)  allEl.textContent  = funeralData.length;
  if (showEl) showEl.textContent = filteredDataWithPrice.length;

  // ─── 7) SORTING ────────────────────────────────────────────────────────────
  if (filters.sortBy) {
    filteredDataWithPrice.sort((a,b) => {
      const lowPrice = item => {
        let low = Infinity;
        for (let d of selectedDays) {
          const raw = item[dayMap[d]] || "";
          const p   = parseFloat(raw.toString().replace(/[^\d.]/g,""));
          if (!isNaN(p) && p < low) low = p;
        }
        return low;
      };
      const A = lowPrice(a), B = lowPrice(b);
      switch (filters.sortBy) {
        case "price-asc":           return A - B;
        case "price-desc":          return B - A;
        case "google-rating-desc":  return (parseFloat(b["Google Rating"])||0)
                                     - (parseFloat(a["Google Rating"])||0);
        case "facebook-rating-desc":return (parseFloat(b["Facebook Rating"])||0)
                                     - (parseFloat(a["Facebook Rating"])||0);
        case "google-reviews-desc": return (parseInt(b["Google Reviews"])||0)
                                     - (parseInt(a["Google Reviews"])||0);
        case "facebook-reviews-desc":return (parseInt(b["Facebook Reviews"])||0)
                                     - (parseInt(a["Facebook Reviews"])||0);
        default: return 0;
      }
    });
  }

  // ─── 8) RENDER RESULTS ─────────────────────────────────────────────────────
  const anyFilterActive = Object.keys(filters).some(cat => {
    if (["priceMin","priceMax"].includes(cat)) {
      return priceFilterActive;
    }
    const v = filters[cat];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });

  // Before rendering
  console.log("🎨 About to render with anyFilterActive:", anyFilterActive);

  // Always use Webflow population version
  paginateResults(filteredDataWithPrice);
}


// GLOBAL PAGINATION SETUP
let currentPage = 1;
const resultsPerPage = 10;
function renderPaginationControls(totalPages) {
  const container = document.getElementById('pagination-container') || document.querySelector('.pagination-container');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) {
      btn.className = 'pagination-button-active';
    } else {
      btn.className = 'pagination-button-inactive';
    }
    btn.addEventListener('click', () => {
      if (currentPage !== i) {
        currentPage = i;
        applyFilters();
      }
    });
    container.appendChild(btn);
  }
}

function paginateResults(filteredData) {
  const totalPages = Math.ceil(filteredData.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);
  // Batch DOM updates for performance
  requestAnimationFrame(() => {
    renderResults(paginatedData);
    renderPaginationControls(totalPages);
  });
}

// Price Slider Div Setup
function setupPriceSliderDiv() {
  const track     = document.getElementById("price-band-bar");
  const minThumb  = document.getElementById("price-min");
  const maxThumb  = document.getElementById("price-max");
  const minOutput = document.getElementById("price-range-min");
  const maxOutput = document.getElementById("price-range-max");
  const minLabel  = document.getElementById("price-min-value");
  const maxLabel  = document.getElementById("price-max-value");

  if (!track || !minThumb || !maxThumb) {
    return;
  }

  // Use the current filtered price band for slider mapping
  const stats = window.sliderMapping || getFullPricingStats();
  let currentMin = filters.priceMin ?? stats.min;
  let currentMax = filters.priceMax ?? stats.max;
  filters.priceMin = currentMin;
  filters.priceMax = currentMax;

  // Position thumbs within the price band bar
  function setThumbPositions() {
    const { min, p33, p66, max } = stats;
    const percentMin = valueToPercent(filters.priceMin, min, p33, p66, max);
    const percentMax = valueToPercent(filters.priceMax, min, p33, p66, max);
    minThumb.style.left = percentMin + "%";
    maxThumb.style.left = percentMax + "%";
    if (minOutput) minOutput.textContent = `$${filters.priceMin.toLocaleString()}`;
    if (maxOutput) maxOutput.textContent = `$${filters.priceMax.toLocaleString()}`;
    if (minLabel)  minLabel.textContent  = `$${filters.priceMin.toLocaleString()}`;
    if (maxLabel)  maxLabel.textContent  = `$${filters.priceMax.toLocaleString()}`;
    minThumb.style.display = '';
    maxThumb.style.display = '';
    // Log for troubleshooting
    console.log('[Slider] setThumbPositions', {percentMin, percentMax, priceMin: filters.priceMin, priceMax: filters.priceMax});
  }
  setThumbPositions();

  let lastMinFrac = valueToPercent(filters.priceMin, stats.min, stats.p33, stats.p66, stats.max) / 100;
  let lastMaxFrac = valueToPercent(filters.priceMax, stats.min, stats.p33, stats.p66, stats.max) / 100;

  function onDragStart(e, isMin) {
    e.preventDefault();
    const rect = track.getBoundingClientRect();

    function onDragMove(evt) {
      evt.preventDefault();
      const m = window.sliderMapping || getFullPricingStats();
      const clientX = evt.type.startsWith("touch")
        ? evt.touches[0].clientX
        : evt.clientX;
      // Confine x to the price band bar only
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      let frac = x / rect.width;
      // prevent crossing
      if (isMin) {
        const maxPct = parseFloat(maxThumb.style.left) || 100;
        if (frac * 100 > maxPct) frac = maxPct / 100;
        lastMinFrac = frac;
      } else {
        const minPct = parseFloat(minThumb.style.left) || 0;
        if (frac * 100 < minPct) frac = minPct / 100;
        lastMaxFrac = frac;
      }
      if (filters.priceBand.length) {
        filters.priceBand = [];
        document.querySelectorAll('[data-category="priceBand"] input')
          .forEach(cb => cb.checked = false);
        updateSelectedFilters();
      }
      // compute the new value
      const value = Math.round(
        piecewisePercentileToValue(frac, m.min, m.p33, m.p66, m.max)
      );
      // live‐update
      if (isMin) {
        currentMin = value;
        minThumb.style.left = `${(frac * 100).toFixed(2)}%`;
        filters.priceMin    = currentMin;
        if (minOutput) minOutput.textContent = `$${currentMin.toLocaleString()}`;
        if (minLabel ) minLabel.textContent  = `$${currentMin.toLocaleString()}`;
      } else {
        currentMax = value;
        maxThumb.style.left = `${(frac * 100).toFixed(2)}%`;
        filters.priceMax    = currentMax;
        if (maxOutput) maxOutput.textContent = `$${currentMax.toLocaleString()}`;
        if (maxLabel ) maxLabel.textContent  = `$${currentMax.toLocaleString()}`;
      }
      // Log for troubleshooting
      console.log('[Slider] Thumbs moved:', {isMin, currentMin, currentMax, filters: {...filters}});
      updateSelectedFilters();
    }

    function onDragEnd() {
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup",   onDragEnd);
      document.removeEventListener("touchmove", onDragMove);
      document.removeEventListener("touchend",  onDragEnd);
      const m = window.sliderMapping || getFullPricingStats();
      const finalMin = Math.round(
        piecewisePercentileToValue(lastMinFrac, m.min, m.p33, m.p66, m.max)
      );
      const finalMax = Math.round(
        piecewisePercentileToValue(lastMaxFrac, m.min, m.p33, m.p66, m.max)
      );
      filters.priceMin = finalMin;
      filters.priceMax = finalMax;
      setThumbPositions();
      updateSelectedFilters();
      applyFilters(true);
      // Log for troubleshooting
      console.log('[Slider] Drag end:', {finalMin, finalMax, filters: {...filters}});
    }

    document.addEventListener("mousemove", onDragMove, { passive: false });
    document.addEventListener("mouseup",   onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("touchend",  onDragEnd);
  }

  minThumb.addEventListener("mousedown",  e => onDragStart(e, true));
  maxThumb.addEventListener("mousedown",  e => onDragStart(e, false));
  minThumb.addEventListener("touchstart", e => onDragStart(e, true));
  maxThumb.addEventListener("touchstart", e => onDragStart(e, false));
}


// UPDATE SLIDER UI (for filtering via manual input)
function updateSliderUI() {
  let minVal = parseInt(priceMinInput.value);
  let maxVal = parseInt(priceMaxInput.value);
  if (minVal > maxVal) minVal = maxVal;
  if (maxVal < minVal) maxVal = minVal;
  filters.priceMin = minVal;
  filters.priceMax = maxVal;
  if (displayMin) { displayMin.textContent = `$${minVal.toLocaleString()}`; }
  if (displayMax) { displayMax.textContent = `$${maxVal.toLocaleString()}`; }
  updateSelectedFilters();
  applyFilters();
  window.updateSliderUI = updateSliderUI;
}

// RESET PRICE SLIDER
function resetPriceSlider() {
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  const rangeTrack = document.getElementById("price-band-bar");
  // Optional outputs
  const minOutput = document.getElementById("price-range-min");
  const maxOutput = document.getElementById("price-range-max");
  const minValue = window.globalMinPrice;
  const maxValue = window.globalMaxPrice;
  // Update thumbs visually
  const percentMin = 0;
  const percentMax = 100;
  minThumb.style.left = `${percentMin}%`;
  maxThumb.style.left = `${percentMax}%`;
  if (minOutput) { minOutput.textContent = `$${minValue.toLocaleString()}`; }
  if (maxOutput) { maxOutput.textContent = `$${maxValue.toLocaleString()}`; }
  
  const priceMinValueSpan = document.getElementById("price-min-value");
  const priceMaxValueSpan = document.getElementById("price-max-value");
  if (priceMinValueSpan) { priceMinValueSpan.textContent = `$${minValue.toLocaleString()}`; }
  if (priceMaxValueSpan) { priceMaxValueSpan.textContent = `$${maxValue.toLocaleString()}`; }

  filters.priceMin = minValue;
  filters.priceMax = maxValue;
  console.log("🔁 Resetting price slider to full range");
}

// RESET SLIDER THUMBS ONLY
function resetSliderThumbsOnly() {
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  minThumb.style.left = `0%`;
  maxThumb.style.left = `100%`;
  const minOutput = document.getElementById("price-range-min");
  const maxOutput = document.getElementById("price-range-max");
  if (minOutput) { minOutput.textContent = `$${window.globalMinPrice.toLocaleString()}`; }
  if (maxOutput) { maxOutput.textContent = `$${window.globalMaxPrice.toLocaleString()}`; }
}

function getFilteredDataExcludingPrice() {
  return funeralData.filter(item => {
    if (filters.searchTerm) {
      const name = (item["Funeral Parlour Name"] || "").toLowerCase();
      if (!name.includes(filters.searchTerm)) {
        return false;
      }
    }
    Object.keys(filters).forEach(key => {
      if (["priceMin", "priceMax", "sortBy", "searchTerm"].includes(key)) return;
      if (Array.isArray(filters[key]) && filters[key].length > 0) {
        const field = filterKeyMap[key];
        if (!field) return;
        const itemValue = (item[field] || "").toString().toLowerCase();
        if (!filters[key].some(val => itemValue.includes(val.toLowerCase()))) {
          return false;
        }
      }
    });
    return true;
  });
}