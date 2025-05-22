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

// Add this at the top level
const PRICE_BAND_CONFIG = {
  lower: {
    position: { min: 0, max: 33.33 },
    getValues: (stats) => ({ min: stats.min, max: stats.p33 })
  },
  middle: {
    position: { min: 33.33, max: 66.66 },
    getValues: (stats) => ({ min: stats.p33, max: stats.p66 })
  },
  upper: {
    position: { min: 66.66, max: 100 },
    getValues: (stats) => ({ min: stats.p66, max: stats.max })
  }
};

// Add this at the top level
let isInitializing = true;
let lastThumbPositions = { min: null, max: null };

// Add at the top level
let currentBandState = {
  active: false,
  band: null,
  positions: null,
  values: null
};

// Add at the top level
const FILTER_TYPES = {
  PRICE: {
    BAND: 'priceBand',
    RANGE: 'priceRange',
    MAX: 'priceMax'
  },
  NON_PRICE: {
    LOCATION: 'location',
    CASKET: 'casket',
    TENTAGE: 'tentage',
    CATERING: 'catering',
    HEARSE: 'hearse',
    PERSONNEL: 'personnel',
    MONKS: 'monks',
    DAYS: 'days',
    SEARCH: 'searchTerm',
    SORT: 'sortBy'
  }
};

// Add at the top level
window.priceStats = {
  original: null,  // Never changes after initial load
  filtered: null   // Changes only with non-price filters
};

let activePriceFilter = {
  type: null, // 'band', 'range', or null
  value: null, // band name or {min, max} for range
  positions: null, // {min, max} percentages
  values: null // {min, max} actual values
};

function initializePage() {
  // Initialize price filter state first
  window.priceStats = {
    original: null,
    filtered: null
  };
  
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

  // Wait for DOM to be fully loaded before fetching data
  setTimeout(async function () {
    await fetchFuneralData();
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
  }, 1500);
}

// Ensure we wait for DOM content to be loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

async function fetchFuneralData() {
  const jsonUrl = "https://raw.githubusercontent.com/Marcellolepoe/pgdata/main/cleaned_buddhist_funeral_directory.json";
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error("Failed to fetch data.");
    funeralData = await response.json();
    window.funeralData = funeralData;
    
    // Calculate and store price stats FIRST
    window.priceStats.original = getFullPricingStats();
    window.priceStats.filtered = window.priceStats.original;
    window.sliderMapping = window.priceStats.original;
    
    // Initialize filters with correct initial values
    filters.priceMin = window.priceStats.original.min;
    filters.priceMax = window.priceStats.original.max;
    
    // Then set up UI elements
    setupPriceSliderDiv();
    
    // Update display elements
    const allCountEl = document.getElementById("all-results");
    const showEl = document.getElementById("showed-results");
    if (allCountEl) allCountEl.textContent = funeralData.length;
    if (showEl) showEl.textContent = funeralData.length;

    // Show all results initially
    renderResults(funeralData);
    
    // Then apply any URL parameters
    getFiltersFromURL();
  } catch (error) {
    console.error("❌ Error fetching funeral data:", error);
  }
}

window.onload = async function () {
  await fetchFuneralData();
};

function valueToPercent(v, minVal, p33, p66, maxVal) {
  if (!minVal || !maxVal) return 0;
  
  if (v <= p33) {
    return ((v - minVal) / (p33 - minVal)) * 33;
  } else if (v <= p66) {
    return 33 + ((v - p33) / (p66 - p33)) * 33;
  } else {
    return 66 + ((v - p66) / (maxVal - p66)) * 34;
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
      try {
        const val = parseInt(manualMaxInput.value.replace(/[^\d]/g, ""), 10);
        if (!isNaN(val) && val > 0) {
          const stats = window.priceStats?.original;
          if (!stats) return;
          
          const maxAllowed = stats.max;
          const validValue = Math.min(val, maxAllowed);
          
          // Calculate the correct position
          const maxPercent = valueToPercent(validValue, stats.min, stats.p33, stats.p66, stats.max);
          
          // Update thumb position
          const maxThumb = document.getElementById("price-max");
          if (maxThumb) {
            requestAnimationFrame(() => {
              maxThumb.style.left = `${maxPercent}%`;
            });
          }
          
          // Update filter state
          filters.priceMax = validValue;
          filters.priceBand = []; // Clear any active band selection
          
          updateSelectedFilters();
          applyFilters(true);
        }
      } catch (error) {
        console.warn('Error handling price max input:', error);
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
      console.log('[DEBUG] Clear All clicked');
      
      // Reset filters
      filters.priceMin = window.priceStats.original.min;
      filters.priceMax = window.priceStats.original.max;
      filters.priceBand = [];
      filters.searchTerm = "";
      
      // Reset all array filters
      Object.keys(filters).forEach(key => {
        if (Array.isArray(filters[key])) {
          filters[key] = [];
        }
      });

      // Reset checkboxes and band selections
      document.querySelectorAll('.filter-checkbox input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
      document.querySelectorAll('[data-band]')
        .forEach(b => b.classList.remove('selected'));
      
      // Reset slider state flags
      window.isPriceDragging = false;
      window._sliderJustDragged = false;
      
      console.debug('[CLEAR] Resetting to initial state:', {
        globalMinPrice: window.priceStats.original.min,
        globalMaxPrice: window.priceStats.original.max,
        filters
      });

      // Force UI updates
      updatePriceFilterUI();
      updateSelectedFilters();
      applyFilters(false);

      // Update results count
      const showEl = document.getElementById("showed-results");
      const allEl = document.getElementById("all-results");
      if (showEl && allEl) {
        const totalCount = window.funeralData.length;
        showEl.textContent = totalCount;
        allEl.textContent = totalCount;
      }
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
    });
  });
}

// Add this helper to handle band selection
function handlePriceBandSelection(band) {
  const stats = window.priceStats.original;
  if (!stats) return;

  // If clicking the same band, clear it
  if (filters.priceBand[0] === band) {
    clearPriceFilter();
    return;
  }

  // Set the band filter
  filters.priceBand = [band];
  
  // Update thumbs based on band
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  if (minThumb && maxThumb) {
    let minPos, maxPos;
    switch(band) {
      case 'lower':
        minPos = 0;
        maxPos = 33.33;
        break;
      case 'middle':
        minPos = 33.33;
        maxPos = 66.66;
        break;
      case 'upper':
        minPos = 66.66;
        maxPos = 100;
        break;
    }
    requestAnimationFrame(() => {
      minThumb.style.left = `${minPos}%`;
      maxThumb.style.left = `${maxPos}%`;
    });
  }

  updateSelectedFilters();
  applyFilters(true);
}

// GET FILTERS FROM URL
function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  Object.keys(filters).forEach(category => {
    if (category === "priceMin") {
      const val = parseFloat(params.get("priceMin"));
      filters.priceMin = isNaN(val) ? window.priceStats.original.min : val;
    } else if (category === "priceMax") {
      const val = parseFloat(params.get("priceMax"));
      filters.priceMax = isNaN(val) ? window.priceStats.original.max : val;
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

  // Helper to add a filter tag
  const addFilterTag = (label, value, category) => {
    if (tagCount > 0) {
      const separator = document.createElement("span");
      separator.classList.add("filter-separator");
      separator.innerHTML = " | ";
      selectedFiltersDiv.appendChild(separator);
    }
    const filterTag = document.createElement("span");
    filterTag.classList.add("filter-tag");
    filterTag.innerHTML = `<strong>${label}:</strong> ${value}
      <button class="clear-category" data-category="${category}">✕</button>`;
    selectedFiltersDiv.appendChild(filterTag);
    tagCount++;
    hasFilters = true;
  };

  // Handle price band filters
  if (filters.priceBand.length > 0) {
    const band = filters.priceBand[0];
    const stats = window.priceStats?.filtered || window.priceStats?.original;
    if (stats) {
      let range;
      if (band === 'lower') range = `$${stats.min.toLocaleString()} – $${stats.p33.toLocaleString()}`;
      else if (band === 'middle') range = `$${stats.p33.toLocaleString()} – $${stats.p66.toLocaleString()}`;
      else if (band === 'upper') range = `$${stats.p66.toLocaleString()} – $${stats.max.toLocaleString()}`;
      if (range) {
        addFilterTag('Price Band', range, 'priceBand');
      }
    }
  }
  // Handle manual price range
  else if (filters.priceMin !== null || filters.priceMax !== null) {
    const stats = window.priceStats?.filtered || window.priceStats?.original;
    if (stats) {
      const isMaxOnly = filters.priceMin === null && filters.priceMax !== null;
      if (isMaxOnly) {
        addFilterTag('Price', `$${filters.priceMax.toLocaleString()} Max`, 'price');
      } else {
        const minPrice = filters.priceMin !== null ? filters.priceMin : stats.min;
        const maxPrice = filters.priceMax !== null ? filters.priceMax : stats.max;
        addFilterTag('Price', `$${minPrice.toLocaleString()} – $${maxPrice.toLocaleString()}`, 'price');
      }
    }
  }

  // Handle other filters...
  Object.keys(filters).forEach((category) => {
    if (category === 'priceBand' || category === 'priceMin' || category === 'priceMax') return;
    const val = filters[category];
    if (Array.isArray(val) && val.length > 0) {
      const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
      addFilterTag(formattedCategory, val.join(", "), category);
    }
  });

  if (!hasFilters) {
    selectedFiltersDiv.innerHTML = `<p style="color: gray;">No filters selected.</p>`;
  }

  // Add click handlers for clear buttons
  selectedFiltersDiv.querySelectorAll(".clear-category").forEach(button => {
    button.addEventListener("click", function() {
      const category = this.dataset.category;
      if (category === 'priceBand') {
        clearPriceFilter();
      } else if (category === 'price') {
        clearPriceFilter();
        const manualMaxInput = document.getElementById("price-input-max");
        if (manualMaxInput) manualMaxInput.value = "";
      } else {
        // Handle non-price filters
        if (Array.isArray(filters[category])) {
          filters[category] = [];
          document.querySelectorAll(`[data-category="${category}"] input`)
            .forEach(cb => cb.checked = false);
        }
      }
      
      // Update UI and reapply filters
      updateSelectedFilters();
      updatePriceFilterUI();
      applyFilters(true);
    });
  });
}

// Reset Price Slider (Full Range)
function resetPriceSlider() {
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  if (minThumb && maxThumb) {
    minThumb.style.left = "0%";
    maxThumb.style.left = "100%";
  }
  filters.priceMin = window.priceStats.original.min;
  filters.priceMax = window.priceStats.original.max;
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
    if (span) span.textContent = value.toLocaleString();
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

// Update price display and bands
function updatePriceDisplay(stats) {
  if (!stats) return;
  
  // Update text displays
  updateTextForAll(".lowest-price-display", stats.min);
  updateTextForAll(".lower-band-range", stats.p33);
  updateTextForAll(".median-price-display", stats.median);
  updateTextForAll(".upper-band-range", stats.p66);
  updateTextForAll(".highest-price-display", stats.max);

  // Update visual bands (always equal width)
  updatePriceBandsVisual(stats.min, stats.p33, stats.p66, stats.max);
}

// Main filter application function
function applyFilters(skipBandReset = false) {
  // 1. Apply non-price filters first
  let filteredData = funeralData;
  
  // Apply each non-price filter
  if (filters.searchTerm) {
    filteredData = filteredData.filter(item => 
      (item["Funeral Parlour Name"] || "").toLowerCase().includes(filters.searchTerm.toLowerCase())
    );
  }

  ['location', 'casket', 'tentage', 'catering', 'hearse', 'personnel', 'monks', 'days'].forEach(category => {
    if (filters[category] && filters[category].length > 0) {
      filteredData = filteredData.filter(item => {
        if (category === 'days') {
          return filters[category].some(day => {
            const price = parseFloat((item[`Available Duration (${day} Day${day === '1' ? '' : 's'})`] || "")
              .toString().replace(/[^\d.]/g, ""));
            return !isNaN(price) && price > 0;
          });
        } else {
          const field = filterKeyMap[category];
          if (!field) return true;
          const itemValue = (item[field] || "").toString().toLowerCase();
          return filters[category].some(val => itemValue.includes(val.toLowerCase()));
        }
      });
    }
  });

  // 2. Calculate price stats for filtered data
  const hasNonPriceFilters = ['location', 'casket', 'tentage', 'catering', 'hearse', 'personnel', 'monks', 'days']
    .some(category => filters[category]?.length > 0) || filters.searchTerm;
  
  const hasPriceFilters = filters.priceBand.length > 0 || filters.priceMin !== null || filters.priceMax !== null;

  // Update filtered stats only if we have non-price filters and no price filters
  if (hasNonPriceFilters && !hasPriceFilters) {
    window.priceStats.filtered = calculatePriceStats(filteredData);
    // Reset price thumbs to edges
    const minThumb = document.getElementById("price-min");
    const maxThumb = document.getElementById("price-max");
    if (minThumb && maxThumb) {
      minThumb.style.left = "0%";
      maxThumb.style.left = "100%";
    }
  }

  // 3. Apply price filters if any
  if (hasPriceFilters) {
    const stats = window.priceStats.original; // Always use original stats for price filtering
    filteredData = filteredData.filter(item => {
      const prices = Object.keys(item)
        .filter(key => key.startsWith("Available Duration"))
        .map(key => parseFloat((item[key] || "").toString().replace(/[^\d.]/g, "")))
        .filter(p => !isNaN(p) && p > 0);

      if (prices.length === 0) return false;

      if (filters.priceBand.length > 0) {
        const band = filters.priceBand[0];
        const [min, max] = band === 'lower' ? [stats.min, stats.p33] :
                          band === 'middle' ? [stats.p33, stats.p66] :
                          [stats.p66, stats.max];
        return prices.some(price => price >= min && price <= max);
      }

      return prices.some(price => 
        (filters.priceMin === null || price >= filters.priceMin) &&
        (filters.priceMax === null || price <= filters.priceMax)
      );
    });
  }

  // 4. Update display
  const statsToDisplay = hasPriceFilters ? window.priceStats.original : 
                        (window.priceStats.filtered || window.priceStats.original);
  updatePriceDisplay(statsToDisplay);

  // 5. Update results count and render
  const allEl = document.getElementById("all-results");
  const showEl = document.getElementById("showed-results");
  if (allEl) allEl.textContent = funeralData.length;
  if (showEl) showEl.textContent = filteredData.length;

  // 6. Render results
  currentPage = 1;
  paginateResults(filteredData);
}

// Clear price filter
function clearPriceFilter() {
  filters.priceBand = [];
  filters.priceMin = null;
  filters.priceMax = null;

  const stats = window.priceStats.filtered || window.priceStats.original;
  
  // Reset thumbs to edges
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  if (minThumb && maxThumb) {
    requestAnimationFrame(() => {
      minThumb.style.left = "0%";
      maxThumb.style.left = "100%";
    });
  }

  updatePriceDisplay(stats);
  updateSelectedFilters();
  applyFilters(true);
}

// Get stats from a dataset
function calculatePriceStats(data) {
  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)",
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };

  const prices = data.flatMap(item =>
    Object.values(dayMap).map(key => {
      const raw = item[key] || "";
      return parseFloat(raw.toString().replace(/[^\d.]/g, ""));
    })
  ).filter(p => !isNaN(p) && p > 0);

  const sorted = prices.sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    p33: sorted[Math.floor(sorted.length * 0.33)],
    p66: sorted[Math.floor(sorted.length * 0.66)]
  };
}

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

// Add this after DOM content loaded
document.addEventListener("DOMContentLoaded", function() {
  // Observe thumb position changes
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  
  if (minThumb && maxThumb) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const newLeft = mutation.target.style.left;
          console.log('[DEBUG] Thumb position changed:', {
            element: mutation.target.id,
            oldPosition: lastThumbPositions[mutation.target.id === 'price-min' ? 'min' : 'max'],
            newPosition: newLeft,
            stack: new Error().stack
          });
          lastThumbPositions[mutation.target.id === 'price-min' ? 'min' : 'max'] = newLeft;
        }
      });
    });

    observer.observe(minThumb, { attributes: true });
    observer.observe(maxThumb, { attributes: true });
  }
});

// Add this after setupPriceSliderDiv
function getFilteredDataExcludingPrice() {
  console.log('[DEBUG] getFilteredDataExcludingPrice start');
  
  // Get all non-price filters, but include priceBand for proper state tracking
  const nonPriceFilters = Object.entries(filters).filter(([key]) => 
    !['priceMin', 'priceMax', 'sortBy'].includes(key)
  );

  // Check if we have any active filters (including priceBand)
  const hasActiveFilters = nonPriceFilters.some(([key, value]) => {
    if (key === 'priceBand') {
      return Array.isArray(value) && value.length > 0;
    }
    return Array.isArray(value) ? value.length > 0 : value.trim() !== '';
  });

  if (!hasActiveFilters) {
    console.log('[DEBUG] No non-price filters active, returning all data');
    return funeralData;
  }

  // Apply non-price filters
  const filtered = funeralData.filter(item => {
    // Search term filter
    if (filters.searchTerm) {
      const name = (item["Funeral Parlour Name"] || "").toLowerCase();
      if (!name.includes(filters.searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Array filters (location, casket, etc.)
    for (const [category, values] of nonPriceFilters) {
      if (!Array.isArray(values) || values.length === 0) continue;
      
      // Special handling for priceBand
      if (category === 'priceBand') {
        const stats = window.sliderMapping || getFullPricingStats();
        const dayMap = {
          "1": "Available Duration (1 Day)",
          "2": "Available Duration (2 Day)",
          "3": "Available Duration (3 Days)",
          "4": "Available Duration (4 Days)",
          "5": "Available Duration (5 Days)",
          "6": "Available Duration (6 Days)",
          "7": "Available Duration (7 Days)"
        };
        
        // Get all valid prices for this item
        const prices = Object.values(dayMap).map(key => {
          const raw = item[key] || "";
          return parseFloat(raw.toString().replace(/[^\d.]/g, ""));
        }).filter(p => !isNaN(p));

        // Check if any price falls within the selected band
        const bandRanges = values.map(band => {
          if (band === "lower") return [stats.min, stats.p33];
          if (band === "middle") return [stats.p33, stats.p66];
          if (band === "upper") return [stats.p66, stats.max];
          return null;
        }).filter(Boolean);

        const hasValidPrice = prices.some(price => 
          bandRanges.some(([min, max]) => price >= min && price <= max)
        );

        if (!hasValidPrice) return false;
        continue;
      }

      const field = filterKeyMap[category];
      if (!field) continue;

      const itemValue = (item[field] || "").toString().toLowerCase();
      if (!values.some(val => itemValue.includes(val.toLowerCase()))) {
        return false;
      }
    }

    return true;
  });

  console.log('[DEBUG] getFilteredDataExcludingPrice results:', {
    totalItems: funeralData.length,
    filteredItems: filtered.length,
    activeFilters: nonPriceFilters.filter(([key, value]) => 
      Array.isArray(value) ? value.length > 0 : value.trim() !== ''
    ).map(([key]) => key),
    priceBand: filters.priceBand
  });

  return filtered;
}

// 3. Helper to get stats from data
function getStatsFromData(data) {
  const priceKeys = [
    "Available Duration (1 Day)",
    "Available Duration (2 Day)",
    "Available Duration (3 Days)",
    "Available Duration (4 Days)",
    "Available Duration (5 Days)",
    "Available Duration (6 Days)",
    "Available Duration (7 Days)"
  ];
  const allPrices = data.flatMap(pkg => {
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

// 1. Define and scope clearPriceFilter globally
function clearPriceFilter() {
  // Get the current filtered stats
  const stats = window.priceStats?.filtered;
  if (!stats) return;

  // Reset filter state to the current filtered range
  filters.priceBand = [];
  filters.priceMin = stats.min;
  filters.priceMax = stats.max;
  
  activePriceFilter = {
    type: null,
    value: null,
    positions: { min: 0, max: 100 },
    values: { min: stats.min, max: stats.max }
  };

  // Reset slider positions to the filtered range bounds
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");
  
  // If there's only one price value, lock both thumbs at that position
  if (stats.min === stats.max) {
    const position = valueToPercent(stats.min, stats.min, stats.p33, stats.p66, stats.max);
    if (minThumb && maxThumb) {
      requestAnimationFrame(() => {
        minThumb.style.left = `${position}%`;
        maxThumb.style.left = `${position}%`;
      });
    }
  } else {
    if (minThumb && maxThumb) {
      requestAnimationFrame(() => {
        minThumb.style.left = "0%";
        maxThumb.style.left = "100%";
      });
    }
  }

  // Update UI
  updatePriceFilterUI();
  
  // Ensure we're using the correct stats
  window.sliderMapping = stats;
}
window.clearPriceFilter = clearPriceFilter;

// 3. Store the last non-price-filtered stats in window.currentBandStats
window.currentBandStats = null;

// Restore paginateResults and setupPriceSliderDiv
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

function setupPriceSliderDiv() {
  const track = document.getElementById("price-band-bar");
  const minThumb = document.getElementById("price-min");
  const maxThumb = document.getElementById("price-max");

  if (!track || !minThumb || !maxThumb) {
    console.error('[ERROR] Missing slider elements');
    return;
  }

  // Initialize positions
  const initialStats = window.priceStats?.filtered || getFullPricingStats();
  if (!initialStats) {
    console.error('[ERROR] No price stats available');
    return;
  }

  // Set initial positions
  minThumb.style.left = "0%";
  maxThumb.style.left = "100%";

  let isDragging = false;
  let currentThumb = null;
  let startX = 0;
  let startLeft = 0;

  function onDragStart(e, isMin) {
    e.preventDefault();
    
    // Check if we have only one price in the filtered data
    const currentStats = window.priceStats?.filtered;
    if (currentStats && currentStats.min === currentStats.max) {
      console.log('[DEBUG] Preventing drag - single price value:', currentStats.min);
      return; // Prevent dragging when there's only one price
    }

    isDragging = true;
    currentThumb = isMin ? minThumb : maxThumb;
    window.isPriceDragging = true;
    window._sliderJustDragged = false;

    // Store initial positions
    startX = e.type.startsWith("touch") ? e.touches[0].clientX : e.clientX;
    startLeft = parseFloat(currentThumb.style.left) || (isMin ? 0 : 100);

    // Clear any active band selection
    if (activePriceFilter.type === 'band') {
      clearPriceFilter();
    }

    const rect = track.getBoundingClientRect();
    const dragStats = window.priceStats?.filtered || getFullPricingStats();

    function onDragMove(evt) {
      if (!isDragging) return;
      evt.preventDefault();

      try {
        const clientX = evt.type.startsWith("touch") ? evt.touches[0].clientX : evt.clientX;
        const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const frac = x / rect.width;
        
        const value = Math.round(piecewisePercentileToValue(frac, dragStats.min, dragStats.p33, dragStats.p66, dragStats.max));
        const percent = valueToPercent(value, dragStats.min, dragStats.p33, dragStats.p66, dragStats.max);

        if (isMin) {
          const maxPct = parseFloat(maxThumb.style.left);
          if (percent <= maxPct - 1) { // Add 1% buffer
            minThumb.style.left = `${percent}%`;
            filters.priceMin = value;
          }
        } else {
          const minPct = parseFloat(minThumb.style.left);
          if (percent >= minPct + 1) { // Add 1% buffer
            maxThumb.style.left = `${percent}%`;
            filters.priceMax = value;
          }
        }

        // Update price filter using filtered stats
        setPriceFilter('range', null, null, {
          min: filters.priceMin,
          max: filters.priceMax
        });
        
        // Force reflow to ensure smooth movement
        void currentThumb.offsetHeight;
        
        updateSelectedFilters();
      } catch (error) {
        console.warn('Error during thumb drag:', error);
      }
    }

    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      currentThumb = null;
      window.isPriceDragging = false;
      window._sliderJustDragged = true;
      
      // Apply filters with the new price range
      applyFilters(true);

      // Remove listeners
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchend', onDragEnd);
    }

    // Add listeners
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('touchmove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchend', onDragEnd);
  }

  // Setup event listeners
  minThumb.addEventListener('mousedown', e => onDragStart(e, true));
  minThumb.addEventListener('touchstart', e => onDragStart(e, true));
  maxThumb.addEventListener('mousedown', e => onDragStart(e, false));
  maxThumb.addEventListener('touchstart', e => onDragStart(e, false));
}