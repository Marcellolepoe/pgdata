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

// Add global flag for slider drag state
window._sliderJustDragged = false;

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
    
    window.globalMinPrice = Math.min(...allPrices);
    window.globalMaxPrice = Math.max(...allPrices);
    
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
        setPriceFilter({ maxInput: true, max: val });
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
      return;
    }
    checkbox.addEventListener("change", function () {
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
          return;
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
  if (googleStarsDiv) {
    if (!isNaN(googleRating) && googleRating > 0) {
      googleStarsDiv.innerHTML = renderStars(googleRating);
      googleStarsDiv.style.display = '';
    } else {
      googleStarsDiv.style.display = 'none';
    }
  }

  // Facebook Stars (set on fb-stars-div)
  const fbStarsDiv = cardWrapper.querySelector('#fb-stars-div, .fb-stars-div');
  const fbRating = parseFloat(funeral["Facebook Rating"]);
  if (fbStarsDiv) {
    if (!isNaN(fbRating) && fbRating > 0) {
      fbStarsDiv.innerHTML = renderStars(fbRating);
      fbStarsDiv.style.display = '';
    } else {
      fbStarsDiv.style.display = 'none';
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
  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)",
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };
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
  updateTextForAll(".lowest-price-display",  filteredMin);
  updateTextForAll(".lower-band-range",     lowerBand);
  updateTextForAll(".median-price-display", median);
  updateTextForAll(".upper-band-range",     upperBand);
  updateTextForAll(".highest-price-display",filteredMax);
  updatePriceBandsVisual(filteredMin, lowerBand, upperBand, filteredMax);
  window.sliderMapping = { min: filteredMin, p33: lowerBand, p66: upperBand, max: filteredMax };
  // Only reset thumbs if skipFilterReset is false, NOT currently dragging, and not just dragged
  if (!skipFilterReset && !window.isPriceDragging && !window._sliderJustDragged) {
    console.debug('[SLIDER] Thumbs forcibly reset by updatePricingBands', {filteredMin, filteredMax});
    filters.priceMin = filteredMin;
    filters.priceMax = filteredMax;
    positionThumbs(filteredMin, filteredMax, filteredMin, filteredMax);
  } else {
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

// Define applyFilters at the top-level so it is always available
function applyFilters(skipBandReset = false) {
  // 1) SETUP
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

  // 2) NON‑PRICE FILTERING
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

  // 3) PRICE‑BAND vs MANUAL SLIDER
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

  // 3a) SNAP THUMBS INTO BAND RANGE ONCE
  if (priceBandActive && !window.isPriceDragging) {
    const newMin = Math.min(...bandRanges.map(([lo,hi]) => lo));
    const newMax = Math.max(...bandRanges.map(([lo,hi]) => hi));
    filters.priceMin = newMin;
    filters.priceMax = newMax;
    positionThumbs(stats.min, stats.max, newMin, newMax);
  }

  // 4) UPDATE THE COLORED BANDS VISUALS
  if (!window.isPriceDragging) {
    updatePricingBands(filteredDataForBands, priceBandActive);
  }

  // 5) FINAL PRICE FILTERING
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

  // 6) UPDATE COUNTERS
  const allEl  = document.getElementById("all-results");
  const showEl = document.getElementById("showed-results");
  if (allEl)  allEl.textContent  = funeralData.length;
  if (showEl) showEl.textContent = filteredDataWithPrice.length;

  // 7) SORTING
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

  // 8) RENDER RESULTS
  paginateResults(filteredDataWithPrice);
  console.debug('[SLIDER] applyFilters complete', {priceMin: filters.priceMin, priceMax: filters.priceMax, skipBandReset, _sliderJustDragged: window._sliderJustDragged});
}

// After every call to applyFilters, call setThumbPositions
// (Call this after data load, after sorting, after slider drag end, etc.)
// Example: after fetchFuneralData, after sorting, after clear all, after slider drag end

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

  // Restore the local setThumbPositions function
  function setThumbPositions() {
    const { min, p33, p66, max } = stats;
    let percentMin = valueToPercent(filters.priceMin, min, p33, p66, max);
    let percentMax = valueToPercent(filters.priceMax, min, p33, p66, max);
    percentMin = Math.max(0, Math.min(100, percentMin));
    percentMax = Math.max(0, Math.min(100, percentMax));
    if (minThumb) minThumb.style.left = percentMin + "%";
    if (maxThumb) maxThumb.style.left = percentMax + "%";
    if (minOutput) minOutput.textContent = `$${filters.priceMin.toLocaleString()}`;
    if (maxOutput) maxOutput.textContent = `$${filters.priceMax.toLocaleString()}`;
    if (minLabel)  minLabel.textContent  = `$${filters.priceMin.toLocaleString()}`;
    if (maxLabel)  maxLabel.textContent  = `$${filters.priceMax.toLocaleString()}`;
    if (minThumb) minThumb.style.display = '';
    if (maxThumb) maxThumb.style.display = '';
    console.debug('[SLIDER] setThumbPositions', {
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      percentMin,
      percentMax
    });
  }
  setThumbPositions();

  let lastMinFrac = valueToPercent(filters.priceMin, stats.min, stats.p33, stats.p66, stats.max) / 100;
  let lastMaxFrac = valueToPercent(filters.priceMax, stats.min, stats.p33, stats.p66, stats.max) / 100;

  function onDragStart(e, isMin) {
    e.preventDefault();
    window.isPriceDragging = true;
    console.debug('[SLIDER] Drag Start', {isMin, priceMin: filters.priceMin, priceMax: filters.priceMax});
    const rect = track.getBoundingClientRect();

    function onDragMove(evt) {
      evt.preventDefault();
      const m = window.sliderMapping || getFullPricingStats();
      const clientX = evt.type.startsWith("touch")
        ? evt.touches[0].clientX
        : evt.clientX;
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      let frac = x / rect.width;
      
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
      
      const value = Math.round(
        piecewisePercentileToValue(frac, m.min, m.p33, m.p66, m.max)
      );
      
      if (isMin) {
        currentMin = value;
        minThumb.style.left = `${(frac * 100).toFixed(2)}%`;
        filters.priceMin = currentMin;
        if (minOutput) minOutput.textContent = `$${currentMin.toLocaleString()}`;
        if (minLabel) minLabel.textContent = `$${currentMin.toLocaleString()}`;
      } else {
        currentMax = value;
        maxThumb.style.left = `${(frac * 100).toFixed(2)}%`;
        filters.priceMax = currentMax;
        if (maxOutput) maxOutput.textContent = `$${currentMax.toLocaleString()}`;
        if (maxLabel) maxLabel.textContent = `$${currentMax.toLocaleString()}`;
      }
      updateSelectedFilters();
    }

    function onDragEnd() {
      window.isPriceDragging = false;
      window._sliderJustDragged = true;
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup", onDragEnd);
      document.removeEventListener("touchmove", onDragMove);
      document.removeEventListener("touchend", onDragEnd);
      
      const m = window.sliderMapping || getFullPricingStats();
      const finalMin = Math.round(
        piecewisePercentileToValue(lastMinFrac, m.min, m.p33, m.p66, m.max)
      );
      const finalMax = Math.round(
        piecewisePercentileToValue(lastMaxFrac, m.min, m.p33, m.p66, m.max)
      );
      
      // Update filters and thumb positions without resetting
      filters.priceMin = finalMin;
      filters.priceMax = finalMax;
      setThumbPositions();
      updateSelectedFilters();
      console.debug('[SLIDER] Drag End', {finalMin, finalMax});
      // applyFilters with skipBandReset true so thumbs never reset after drag
      applyFilters(true);
      // After applyFilters, clear the justDragged flag (on next tick)
      setTimeout(() => { window._sliderJustDragged = false; }, 0);

      // --- Price Band Click & Highlight Logic ---
      let matched = null;
      if (bandRangeMatches(finalMin, finalMax, m, 'lower')) matched = 'lower';
      if (bandRangeMatches(finalMin, finalMax, m, 'middle')) matched = 'middle';
      if (bandRangeMatches(finalMin, finalMax, m, 'upper')) matched = 'upper';
      if (matched) {
        filters.priceBand = [matched];
        setBandHighlight(matched);
        console.debug('[BAND] Slider drag matches band', matched);
      } else {
        filters.priceBand = [];
        clearBandHighlight();
        console.debug('[BAND] Slider drag: no band match, highlight cleared');
      }
      // --- End Band Click Logic ---
    }

    document.addEventListener("mousemove", onDragMove, { passive: false });
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("touchend", onDragEnd);
  }

  minThumb.addEventListener("mousedown", e => onDragStart(e, true));
  maxThumb.addEventListener("mousedown", e => onDragStart(e, false));
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

document.querySelectorAll('[data-band]').forEach(bandEl => {
  bandEl.addEventListener('click', function() {
    const band = this.getAttribute('data-band'); // 'lower', 'middle', 'upper'
    const stats = window.sliderMapping || getFullPricingStats();
    if (band === 'lower') {
      filters.priceMin = stats.min;
      filters.priceMax = stats.p33;
    } else if (band === 'middle') {
      filters.priceMin = stats.p33;
      filters.priceMax = stats.p66;
    } else if (band === 'upper') {
      filters.priceMin = stats.p66;
      filters.priceMax = stats.max;
    }
    setThumbPositions();
    updateSelectedFilters();
    applyFilters();
  });
});

// Add this CSS via JS for slider thumbs and All Filters panel
const style = document.createElement('style');
style.innerHTML = `
#price-min, #price-max {
  position: absolute;
  top: 0;
  z-index: 2;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  background: #4caf50;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: box-shadow 0.2s;
}
#price-max {
  transform: translateX(-80%);
}
#price-min {
  transform: translateX(-50%);
}
#price-min:active, #price-max:active {
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.filter-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow-y: auto;
  z-index: 1000;
  background: rgba(255,255,255,0.98);
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}
.all-filters-panel {
  max-height: 90vh;
  overflow-y: auto;
  margin-top: 0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100vw;
  background: #fff;
  z-index: 1001;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  border-bottom: 1px solid #eee;
}
.all-filters-close {
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1002;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  text-align: right;
}
`;
document.head.appendChild(style);

// Example overlay open/close stub (add if not present):
window.openFilterOverlay = function() {
  const overlay = document.querySelector('.filter-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }
};
window.closeFilterOverlay = function() {
  const overlay = document.querySelector('.filter-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
};

// --- Price Band Click & Highlight Logic ---
function setBandHighlight(band) {
  ['lower', 'middle', 'upper'].forEach(b => {
    const el = document.getElementById('band-' + b);
    if (el) el.classList.toggle('band-active', b === band);
  });
}
function clearBandHighlight() {
  ['lower', 'middle', 'upper'].forEach(b => {
    const el = document.getElementById('band-' + b);
    if (el) el.classList.remove('band-active');
  });
}
function bandRangeMatches(min, max, stats, band) {
  if (band === 'lower')  return min === stats.min && max === stats.p33;
  if (band === 'middle') return min === stats.p33 && max === stats.p66;
  if (band === 'upper')  return min === stats.p66 && max === stats.max;
  return false;
}
// Attach click handlers to bands
['lower', 'middle', 'upper'].forEach(band => {
  const el = document.getElementById('band-' + band);
  if (el) {
    el.addEventListener('click', function() {
      setPriceFilter({ band });
    });
  }
});
// --- End Band Click Logic ---

// --- Centralized Price Filter Logic ---
function setPriceFilter({ band = null, min = null, max = null, manual = false, maxInput = false }) {
  if (band) {
    const stats = window.sliderMapping || getFullPricingStats();
    if (band === 'lower')  { min = stats.min;  max = stats.p33; }
    if (band === 'middle') { min = stats.p33; max = stats.p66; }
    if (band === 'upper')  { min = stats.p66; max = stats.max; }
    filters.priceMin = min;
    filters.priceMax = max;
    filters.priceBand = [band];
  } else if (manual) {
    filters.priceBand = [];
    filters.priceMin = min;
    filters.priceMax = max;
  } else if (maxInput) {
    filters.priceBand = [];
    filters.priceMin = window.globalMinPrice;
    filters.priceMax = max;
  }
  syncPriceFilterUI();
  updateSelectedFilters();
  applyFilters(true);
  console.debug('[PRICE] State Change', {band, min, max, manual, maxInput, filters: {...filters}});
}
// --- End Centralized Price Filter Logic ---

// --- Patch Manual Slider Drag ---
// In setupPriceSliderDiv, inside onDragEnd, replace price logic with:
// setPriceFilter({ manual: true, min: finalMin, max: finalMax });
// Remove direct manipulation of filters.priceBand, setBandHighlight, etc.
// --- End Patch Manual Slider Drag ---

// --- Patch Max Price Input ---
document.addEventListener("DOMContentLoaded", function () {
  const manualMaxInput = document.getElementById("price-input-max");
  if (manualMaxInput) {
    manualMaxInput.addEventListener("input", () => {
      const val = parseInt(manualMaxInput.value.replace(/[^\d]/g, ""), 10);
      if (!isNaN(val) && val > 0) {
        setPriceFilter({ maxInput: true, max: val });
      }
    });
  }
});
// --- End Patch Max Price Input ---

// --- Patch Selected Filters Panel ---
// In updateSelectedFilters, for price, if filters.priceBand is set, show both band and price range.
// Otherwise, show only price range. Add debug log for what is shown.
// --- End Patch Selected Filters Panel ---

// --- UI State Synchronization for Price Filters ---
function syncPriceFilterUI() {
  // 1. Sync price band checkboxes
  ['lower', 'middle', 'upper'].forEach(band => {
    const cb = document.querySelector('.filter-checkbox[data-category="priceBand"][data-value="' + band + '"] input');
    if (cb) {
      cb.checked = Array.isArray(filters.priceBand) && filters.priceBand.includes(band);
    }
  });
  // 2. Sync max price input
  const maxInput = document.getElementById('price-input-max');
  if (maxInput) {
    if (filters.priceBand.length || (filters.priceMin !== window.globalMinPrice && filters.priceMax !== window.globalMaxPrice)) {
      maxInput.value = '';
    } else if (filters.priceMin === window.globalMinPrice && filters.priceMax !== window.globalMaxPrice) {
      maxInput.value = filters.priceMax;
    }
  }
  // 3. Always move slider thumbs to match filters
  setThumbPositions();
  console.debug('[UI] syncPriceFilterUI', {
    priceBand: filters.priceBand,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    maxInput: maxInput ? maxInput.value : null
  });
}
// --- End UI State Synchronization ---

// Patch setPriceFilter to always call syncPriceFilterUI after setting filter state
function setPriceFilter({ band = null, min = null, max = null, manual = false, maxInput = false }) {
  if (band) {
    const stats = window.sliderMapping || getFullPricingStats();
    if (band === 'lower')  { min = stats.min;  max = stats.p33; }
    if (band === 'middle') { min = stats.p33; max = stats.p66; }
    if (band === 'upper')  { min = stats.p66; max = stats.max; }
    filters.priceMin = min;
    filters.priceMax = max;
    filters.priceBand = [band];
  } else if (manual) {
    filters.priceBand = [];
    filters.priceMin = min;
    filters.priceMax = max;
  } else if (maxInput) {
    filters.priceBand = [];
    filters.priceMin = window.globalMinPrice;
    filters.priceMax = max;
  }
  syncPriceFilterUI();
  updateSelectedFilters();
  applyFilters(true);
  console.debug('[PRICE] State Change', {band, min, max, manual, maxInput, filters: {...filters}});
}

// Patch all price filter triggers to use syncPriceFilterUI after any change
// (Already handled by setPriceFilter above)

// Patch updateSelectedFilters to call syncPriceFilterUI at the end (to catch any UI drift)
const _originalUpdateSelectedFilters = updateSelectedFilters;
updateSelectedFilters = function() {
  _originalUpdateSelectedFilters.apply(this, arguments);
  syncPriceFilterUI();
};
// --- End Patch ---

// --- Global setThumbPositions ---
function setThumbPositions() {
  const stats = window.sliderMapping || getFullPricingStats();
  const min = stats.min, p33 = stats.p33, p66 = stats.p66, max = stats.max;
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  const minOutput = document.getElementById("price-range-min");
  const maxOutput = document.getElementById("price-range-max");
  const minLabel = document.getElementById("price-min-value");
  const maxLabel = document.getElementById("price-max-value");
  let percentMin = valueToPercent(filters.priceMin, min, p33, p66, max);
  let percentMax = valueToPercent(filters.priceMax, min, p33, p66, max);
  percentMin = Math.max(0, Math.min(100, percentMin));
  percentMax = Math.max(0, Math.min(100, percentMax));
  if (minThumb) minThumb.style.left = percentMin + "%";
  if (maxThumb) maxThumb.style.left = percentMax + "%";
  if (minOutput) minOutput.textContent = `$${filters.priceMin.toLocaleString()}`;
  if (maxOutput) maxOutput.textContent = `$${filters.priceMax.toLocaleString()}`;
  if (minLabel)  minLabel.textContent  = `$${filters.priceMin.toLocaleString()}`;
  if (maxLabel)  maxLabel.textContent  = `$${filters.priceMax.toLocaleString()}`;
  if (minThumb) minThumb.style.display = '';
  if (maxThumb) maxThumb.style.display = '';
  console.debug('[SLIDER] setThumbPositions (global)', {
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    percentMin,
    percentMax
  });
}
// --- End Global setThumbPositions ---