// ==============================
// GLOBAL FILTERS & DATA Setup
// ==============================
console.log("📜 Script starting to load...");

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

console.log("⚙️ Global filters initialized");

let funeralData = [];
let lastFraction = 0;
let lastMaxFraction = 1;
let isPriceDragging = false;

// ==============================
// Wait for Page Load (after Webflow loads)
// ==============================
console.log("⏳ Setting up DOMContentLoaded listener...");

// Single initialization function
function initializePage() {
  console.log("🌐 DOM Content Loaded - Initializing...");
  
  // Check for required elements
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

  // Wait for Webflow to fully load
  setTimeout(function () {
    console.log("🚀 Webflow loaded. Setting up filters...");
    setupFilters();
    getFiltersFromURL();
    updateSelectedFilters();
    
    // Setup sorting
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

    // Initialize the page
    console.log("🚀 Initializing page...");
    fetchFuneralData();
  }, 1500);
}

// Single DOMContentLoaded listener
document.addEventListener("DOMContentLoaded", initializePage);

// Fetch Funeral Data
async function fetchFuneralData() {
  console.log("🚀 fetchFuneralData() started");
  const jsonUrl = "https://raw.githubusercontent.com/Marcellolepoe/pgdata/main/cleaned_buddhist_funeral_directory.json";
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error("Failed to fetch data.");
    funeralData = await response.json();
    console.log(`✅ Loaded ${funeralData.length} funeral packages.`);
    window.funeralData = funeralData;
    
    const allCountEl = document.getElementById("all-results");
  	if (allCountEl) allCountEl.textContent = funeralData.length;

    // Compute full pricing stats using the entire dataset.
    const priceKeys = [
      "Available Duration (1 Day)",
      "Available Duration (2 Day)",
      "Available Duration (3 Days)",
      "Available Duration (4 Days)",
      "Available Duration (5 Days)",
      "Available Duration (6 Days)",
      "Available Duration (7 Days)"
    ];
    // For each package, gather all price values.
    const allPrices = funeralData.flatMap(pkg => {
      return priceKeys.map(key => {
        return parseFloat((pkg[key] || "").toString().replace(/[^\d.]/g, ""));
      });
    }).filter(p => !isNaN(p) && p > 0);
    
    // Set global minimum and maximum from the full dataset.
    window.globalMinPrice = Math.min(...allPrices);  // Should be 988 if present
    window.globalMaxPrice = Math.max(...allPrices);  // E.g., 31610
    
    console.log("Global Prices:", {globalMin: window.globalMinPrice, globalMax: window.globalMaxPrice});
    
    window.sliderMapping = getFullPricingStats();
    
    // Default slider settings: full range (no active price filter).
    filters.priceMin = window.globalMinPrice;
    filters.priceMax = window.globalMaxPrice;
    filters.sortBy = "";
    
    // Initialize the Price Slider.
    setupPriceSliderDiv();
    
    // Apply filters and update the UI.
    console.log("🔄 Calling applyFilters() after data load");
    applyFilters();
    getFiltersFromURL();
  } catch (error) {
    console.error("❌ Error fetching funeral data:", error);
  }
  
}

// Load Data on Page Load
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


// Piecewise Mapping Function
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

// FUNERAL PARLOUR SEARCH
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("funeral-parlour-search");
  if (searchInput) {
    // Prevent Enter from submitting the form
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
    // Re-apply filtering on typing
    searchInput.addEventListener("input", function () {
      filters.searchTerm = this.value.trim().toLowerCase();
      updateSelectedFilters();
      applyFilters();
    });
  }
});

// PRICE MAX INPUT 
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
        // Calculate percent for new max value
        let percentMax = ((val - minValue) / (maxValue - minValue)) * 100;
        percentMax = Math.max(0, Math.min(100, percentMax));
        // Move the max thumb
        maxThumb.style.left = `${percentMax}%`;
        // (If you later add label elements, update them here.)
        updateSelectedFilters();
        applyFilters();
      }
    });
  }
});

// SORTING FUNCTION
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

// CLEAR ALL BUTTON
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

// SETUP FILTERS FUNCTION
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
    
    if (category === "priceBand" && Array.isArray(val) && val.length>0) {
        const pretty = { lower:"Lower", middle:"Middle", upper:"Upper" };
        const labels = val.map(v=>pretty[v]).join(", ");
        const el = document.createElement("span");
        el.classList.add("filter-tag");
        el.innerHTML = `
          <strong>Price Band:</strong> ${labels}
          <button class="clear-category" data-category="priceBand">✕</button>
        `;
        selectedFiltersDiv.appendChild(el);
        tagCount++;
        return; // skip the rest for this category
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
selectedFiltersDiv.querySelectorAll(".clear-category").forEach(function(button) {
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
    } if (category==="priceBand") {
  filters.priceBand = [];
  document.querySelectorAll('[data-category="priceBand"] input')
    .forEach(cb=>cb.checked=false);
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
  // Google Review Score (score and number)
  const googleScoreEl = cardWrapper.querySelectorAll('.google-review-score');
  if (googleScoreEl && googleScoreEl.length > 0) {
    googleScoreEl.forEach(el => {
      if (el.classList.contains('google-review-number')) {
        el.textContent = funeral["Google Reviews"] || "0";
      } else {
        el.textContent = funeral["Google Rating"] || "-";
      }
    });
  }
  // Review Excerpt
  const excerptEl = cardWrapper.querySelector('.review-excerpt');
  if (excerptEl) excerptEl.textContent = funeral["Review Excerpt"] || "";
}

// ADJUST CAROUSEL HEIGHT
function adjustCarouselHeight(wrapper) {
  const activeCard = wrapper.querySelector('.carousel-card.active');
  if (activeCard) {
    const height = activeCard.offsetHeight;
    wrapper.style.height = `${height}px`;
  }
}

// CREATE FUNERAL CARD (Dynamic creation version)
function createFuneralCard(funeral) {
  const card = document.createElement("div");
  card.className = "funeral-card";
  
  // Basic Info
  const name = funeral["Funeral Parlour Name"] || "Not Available";
  const phone = funeral["Contact Number"] || "Not Available";
  const packageName = funeral["Package Name"] || "Unknown";
  
  // Reviews
  const googleRating = funeral["Google Rating"] || "-";
  const googleReviews = funeral["Google Reviews"] || "0";
  const facebookRating = funeral["Facebook Rating"] || "-";
  const facebookReviews = funeral["Facebook Reviews"] || "0";
  
  // Inclusions
  const inclusions = [
    { key: "Casket", value: getInclusionValue(funeral, "Casket") },
    { key: "Catering", value: getInclusionValue(funeral, "Catering") },
    { key: "Tentage", value: getInclusionValue(funeral, "Tentage") },
    { key: "Hearse", value: getInclusionValue(funeral, "Hearse") },
    { key: "Personnel", value: getInclusionValue(funeral, "Personnel") },
    { key: "Monks", value: getInclusionValue(funeral, "Monks") }
  ];
  
  // Pricing
  const pricing = formatAvailablePrices(funeral);
  
  // Build the card HTML
  card.innerHTML = `
    <div class="card-content">
      <h3 class="funeral-name">${name}</h3>
      <p>Phone: ${phone}</p>
      <p>Package: <strong>${packageName}</strong></p>
      
      <div class="reviews-section">
        <div class="google-reviews">
          <span class="stars">${getStarIcons(googleRating)}</span>
          <span class="review-count">(${googleReviews})</span>
        </div>
        <div class="facebook-reviews">
          <span class="stars">${getStarIcons(facebookRating)}</span>
          <span class="review-count">(${facebookReviews})</span>
        </div>
      </div>
      
      <div class="inclusions-section">
        ${inclusions.map(inc => renderIconRow(inc.key, inc.value)).join("")}
      </div>
      
      <div class="pricing-section">
        ${pricing}
      </div>
    </div>
  `;
  
  return card;
}

// RENDER GROUP CARDS
function renderGroupedResults(groupedResults) {
  console.log("🎯 renderGroupedResults() called with", groupedResults?.length || 0, "groups");
  const container = document.getElementById("funeral-cards-container");
  if (!container) {
    console.error("🚨 Funeral Cards Container NOT FOUND!");
    return;
  }

  // Safety check for data
  if (!Array.isArray(groupedResults) || groupedResults.length === 0) {
    console.warn("⚠️ No data to render in renderGroupedResults()");
    container.innerHTML = "<p class='no-results'>No funeral packages found matching your criteria.</p>";
    return;
  }

  container.innerHTML = "";
  groupedResults.forEach((group, groupIndex) => {
    console.log(`📦 Processing group ${groupIndex + 1}/${groupedResults.length}:`, group.name);
    const packages = group.packages;
    if (!Array.isArray(packages) || packages.length === 0) {
      console.warn(`⚠️ Group ${group.name} has no packages, skipping`);
      return;
    }
    const groupWrapper = document.createElement("div");
    groupWrapper.classList.add("parlour-wrapper");
    const carouselWrapper = document.createElement("div");
    carouselWrapper.classList.add("carousel-wrapper");
    const heightWrapper = document.createElement("div");
    heightWrapper.classList.add("carousel-height-wrapper");
    heightWrapper.appendChild(carouselWrapper);
    const cards = packages.map((pkg, i) => {
      const card = createFuneralCard(pkg);
      card.classList.add("carousel-card");
      if (i === 0) {
        card.classList.add("active");
        card.style.zIndex = 101;
      } else {
        card.classList.add("behind");
        card.style.zIndex = 100 - i;
      }
      carouselWrapper.appendChild(card);
      return card;
    });
    const indicatorBar = document.createElement("div");
    indicatorBar.className = "carousel-indicators";
    const pills = packages.map((pkg, i) => {
      const pill = document.createElement("div");
      pill.className = "indicator-pill";
      const circle = document.createElement("div");
      circle.className = "pill-circle";
      const label = document.createElement("div");
      label.className = "pill-label";
      label.innerText = pkg["Package Name"] || `Package ${i + 1}`;
      pill.appendChild(circle);
      pill.appendChild(label);
      pill.addEventListener("click", () => {
        currentIndex = i;
        updateCarousel(i);
      });
      indicatorBar.appendChild(pill);
      return pill;
    });
    let currentIndex = 0;
    function updateCarousel(index) {
      cards.forEach((card, i) => {
        card.classList.remove("active", "behind", "before");
        card.style.opacity = "0";
        card.style.pointerEvents = "none";
        card.style.zIndex = `${100 - Math.abs(index - i)}`;
        if (i === index) {
          card.classList.add("active");
          card.style.opacity = "1";
          card.style.transform = "translateX(0) scale(1)";
          card.style.pointerEvents = "auto";
          card.style.zIndex = 101;
          requestAnimationFrame(() => {
            carouselWrapper.style.height = card.offsetHeight + "px";
          });
        } else if (i > index) {
          card.classList.add("behind");
          card.style.opacity = "0.4";
          card.style.transform = "translateX(30px) scale(0.95)";
        } else if (i < index) {
          card.classList.add("before");
          card.style.opacity = "0.4";
          card.style.transform = "translateX(-30px) scale(0.95)";
        }
      });
      pills.forEach((pill, i) => {
        pill.classList.toggle("active-pill", i === index);
      });
      const activeCard = cards[index];
      requestAnimationFrame(() => {
        heightWrapper.style.height = activeCard.offsetHeight + "px";
      });
      carouselWrapper.classList.toggle("show-left", index > 0);
      carouselWrapper.classList.toggle("show-right", index < cards.length - 1);
    }
    const prevArrow = document.createElement("button");
    prevArrow.className = "carousel-nav prev";
    prevArrow.innerHTML = "‹";
    prevArrow.addEventListener("click", () => {
      if (currentIndex > 0) {
        currentIndex--;
        updateCarousel(currentIndex);
      }
    });
    const nextArrow = document.createElement("button");
    nextArrow.className = "carousel-nav next";
    nextArrow.innerHTML = "›";
    nextArrow.addEventListener("click", () => {
      if (currentIndex < cards.length - 1) {
        currentIndex++;
        updateCarousel(currentIndex);
      }
    });
    groupWrapper.appendChild(prevArrow);
    groupWrapper.appendChild(heightWrapper);
    groupWrapper.appendChild(indicatorBar);
    groupWrapper.appendChild(nextArrow);
    container.appendChild(groupWrapper);
    updateCarousel(currentIndex);
  });
  console.log("✅ renderGroupedResults() completed");
}

// RENDER RESULTS (Webflow population version)
function renderResults(filteredData) {
  console.log("🎯 renderResults() [Webflow population] called with data:", filteredData?.length || 0, "items");
  const container = document.getElementById("funeral-cards-container");
  if (!container) {
    console.error("🚨 Funeral Cards Container NOT FOUND!");
    return;
  }
  // Find all card wrappers
  const cardWrappers = container.querySelectorAll('.funeral-card-wrapper');
  if (!cardWrappers || cardWrappers.length === 0) {
    console.warn("⚠️ No .funeral-card-wrapper elements found in container");
    return;
  }
  // Only populate as many as we have data for
  for (let i = 0; i < Math.min(filteredData.length, cardWrappers.length); i++) {
    populateFuneralCard(cardWrappers[i], filteredData[i]);
  }
  // Optionally, hide extra card wrappers if there are more wrappers than data
  for (let i = filteredData.length; i < cardWrappers.length; i++) {
    cardWrappers[i].style.display = 'none';
  }
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

  if (anyFilterActive) {
    renderResults(filteredDataWithPrice);
  } else {
    // no filters: group by parlour with carousel
    const grouped = [];
    const mapByName = {};
    filteredDataWithPrice.forEach(item => {
      const name = item["Funeral Parlour Name"] || "Unknown";
      if (!mapByName[name]) {
        mapByName[name] = { name, packages: [] };
        grouped.push(mapByName[name]);
      }
      mapByName[name].packages.push(item);
    });
    console.log("📦 Grouped into", grouped.length, "parlours");
    renderGroupedResults(grouped);
  }
}


// GLOBAL PAGINATION SETUP
let currentPage = 1;
const resultsPerPage = 20;
function paginateResults(filteredData) {
  const totalPages = Math.ceil(filteredData.length / resultsPerPage);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);
  renderResults(paginatedData);
  renderPaginationControls(totalPages);
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
    console.error("Slider elements not found");
    return;
  }

  // pull in your current band stats (could be global or filtered)
  const stats = window.sliderMapping || getFullPricingStats();
  let currentMin = stats.min;
  let currentMax = stats.max;
  filters.priceMin = currentMin;
  filters.priceMax = currentMax;

  // initial placement & labels
  positionThumbs(stats.min, stats.max, currentMin, currentMax);
  if (minOutput) minOutput.textContent = `$${currentMin.toLocaleString()}`;
  if (maxOutput) maxOutput.textContent = `$${currentMax.toLocaleString()}`;
  if (minLabel)  minLabel.textContent  = `$${currentMin.toLocaleString()}`;
  if (maxLabel)  maxLabel.textContent  = `$${currentMax.toLocaleString()}`;

  let lastMinFrac = 0, lastMaxFrac = 1;

  function onDragStart(e, isMin) {
    e.preventDefault();
    const rect = track.getBoundingClientRect();

    function onDragMove(evt) {
      evt.preventDefault();
      // always re‑read the band stats in case non‑price filters changed
      const m = window.sliderMapping || getFullPricingStats();

      const clientX = evt.type.startsWith("touch")
        ? evt.touches[0].clientX
        : evt.clientX;
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
    }

    function onDragEnd() {
      // tear down
      document.removeEventListener("mousemove", onDragMove);
      document.removeEventListener("mouseup",   onDragEnd);
      document.removeEventListener("touchmove", onDragMove);
      document.removeEventListener("touchend",  onDragEnd);

      // compute final from saved fractions
      const m = window.sliderMapping || getFullPricingStats();
      const finalMin = Math.round(
        piecewisePercentileToValue(lastMinFrac, m.min, m.p33, m.p66, m.max)
      );
      const finalMax = Math.round(
        piecewisePercentileToValue(lastMaxFrac, m.min, m.p33, m.p66, m.max)
      );

      // update filters & re‑apply
      filters.priceMin = finalMin;
      filters.priceMax = finalMax;
      applyFilters(true);

      // reposition thumbs
      positionThumbs(m.min, m.max, finalMin, finalMax);

      // update displays
      if (minOutput) minOutput.textContent = `$${finalMin.toLocaleString()}`;
      if (maxOutput) maxOutput.textContent = `$${finalMax.toLocaleString()}`;
      if (minLabel ) minLabel.textContent  = `$${finalMin.toLocaleString()}`;
      if (maxLabel ) maxLabel.textContent  = `$${finalMax.toLocaleString()}`;

      // refresh your Selected‑Filters UI
      updateSelectedFilters();
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