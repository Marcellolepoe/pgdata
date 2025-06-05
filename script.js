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
  sortBy: ""
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

// Add at the top level - tracks price stats for display purposes
window.priceStats = {
  original: null,
  lastNonPriceFiltered: null  // This will store the last non-price filtered stats
};

let activePriceFilter = {
  type: null, // 'band', 'range', or null
  value: null, // band name or {min, max} for range
  positions: null, // {min, max} percentages
  values: null // {min, max} actual values
};

// Debug logging utilities
function logFilterState(action) {
  console.group(`Filter State [${action}]`);
  console.log('Price Band:', filters.priceBand);
  console.log('Price Range:', { min: filters.priceMin, max: filters.priceMax });
  console.log('Price Stats:', window.priceStats);
  console.log('Active Price Filter:', activePriceFilter);
  console.groupEnd();
}

// Price calculation safeguards
function safeGetPriceStats() {
  const stats = window.priceStats?.lastNonPriceFiltered || window.priceStats?.original;
  if (!stats) {
    console.warn('No price stats available');
    return null;
  }
  
  if (!stats.min || !stats.max || !stats.p33 || !stats.p66) {
    console.warn('Incomplete price stats:', stats);
    return null;
  }
  
  return stats;
}

// Helper function for piecewise percentile to value conversion
function piecewisePercentileToValue(fraction, min, p33, p66, max) {
  if (!min || !max || !p33 || !p66) {
    console.warn('Missing required price points for conversion');
    return min || 0;
  }

  // Ensure fraction is between 0 and 1
  fraction = Math.max(0, Math.min(1, fraction));
  
  // Piecewise linear interpolation
  if (fraction <= 0.33) {
    return min + (fraction / 0.33) * (p33 - min);
  } else if (fraction <= 0.66) {
    return p33 + ((fraction - 0.33) / 0.33) * (p66 - p33);
  } else {
    return p66 + ((fraction - 0.66) / 0.34) * (max - p66);
  }
}

function initializePage() {
  // Initialize price filter state first
  window.priceStats = {
    original: null,
    lastNonPriceFiltered: null
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
    "price-band-bar"
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
      
      // Get initial price range
      let priceRange = { min: 0, max: 100000 };
      if (window.funeralData && window.funeralData.length > 0) {
        const allPrices = [];
        window.funeralData.forEach(item => {
          for (let i = 1; i <= 7; i++) {
            const key = `Available Duration (${i} Day${i > 1 ? (i === 2 ? '' : 's') : ''})`;
            const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
            if (!isNaN(price) && price > 0) {
              allPrices.push(price);
            }
          }
        });
        
        if (allPrices.length > 0) {
          allPrices.sort((a, b) => a - b);
          priceRange.min = allPrices[0];
          priceRange.max = allPrices[allPrices.length - 1];
        }
      }
      
      // Reset all filters
      filters.priceMin = priceRange.min;
      filters.priceMax = priceRange.max;
      filters.searchTerm = "";
      
      // Reset all array filters
      Object.keys(filters).forEach(key => {
        if (Array.isArray(filters[key])) {
          filters[key] = [];
        }
      });

      // Reset checkboxes
      document.querySelectorAll('.filter-checkbox input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
      
      // Clear price max input
      const manualMaxInput = document.getElementById("price-input-max");
      if (manualMaxInput) manualMaxInput.value = "";
      
      // Update UI and apply filters
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
      
      // Apply non-price filters first and update price stats
      const nonPriceFiltered = getFilteredDataExcludingPrice();
      updatePricingBands(nonPriceFiltered, false);
      
      // Then apply all filters including price
      applyFilters();
    });
  });
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

  // Get initial price range for comparison
  let initialPriceRange = { min: 0, max: 100000 };
  if (window.funeralData && window.funeralData.length > 0) {
    const allPrices = [];
    window.funeralData.forEach(item => {
      for (let i = 1; i <= 7; i++) {
        const key = `Available Duration (${i} Day${i > 1 ? (i === 2 ? '' : 's') : ''})`;
        const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
        if (!isNaN(price) && price > 0) {
          allPrices.push(price);
        }
      }
    });
    
    if (allPrices.length > 0) {
      allPrices.sort((a, b) => a - b);
      initialPriceRange.min = allPrices[0];
      initialPriceRange.max = allPrices[allPrices.length - 1];
    }
  }

  // Handle price range (only show if different from initial range)
  if (filters.priceMin !== initialPriceRange.min || filters.priceMax !== initialPriceRange.max) {
    const isMaxOnly = filters.priceMin === initialPriceRange.min && filters.priceMax !== initialPriceRange.max;
    if (isMaxOnly) {
      addFilterTag('Price', `$${filters.priceMax.toLocaleString()} Max`, 'price');
    } else {
      addFilterTag('Price', `$${filters.priceMin.toLocaleString()} – $${filters.priceMax.toLocaleString()}`, 'price');
    }
  }

  // Handle other filters
  Object.keys(filters).forEach((category) => {
    if (category === 'priceMin' || category === 'priceMax' || category === 'searchTerm' || category === 'sortBy') return;
    const val = filters[category];
    if (Array.isArray(val) && val.length > 0) {
      const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
      addFilterTag(formattedCategory, val.join(", "), category);
    }
  });

  // Handle search term
  if (filters.searchTerm && filters.searchTerm.trim() !== "") {
    addFilterTag('Search', filters.searchTerm, 'searchTerm');
  }

  if (!hasFilters) {
    selectedFiltersDiv.innerHTML = `<p style="color: gray;">No filters selected.</p>`;
  }

  // Add click handlers for clear buttons
  selectedFiltersDiv.querySelectorAll(".clear-category").forEach(button => {
    button.addEventListener("click", function() {
      const category = this.dataset.category;
      
      if (category === 'price') {
        // Reset price to initial range
        filters.priceMin = initialPriceRange.min;
        filters.priceMax = initialPriceRange.max;
        
        // Clear manual input
        const manualMaxInput = document.getElementById("price-input-max");
        if (manualMaxInput) manualMaxInput.value = "";
        
      } else if (category === 'searchTerm') {
        filters.searchTerm = "";
        const searchInput = document.getElementById("funeral-parlour-search");
        if (searchInput) searchInput.value = "";
        
      } else {
        // Handle array filters
        if (Array.isArray(filters[category])) {
          filters[category] = [];
          document.querySelectorAll(`[data-category="${category}"] input`)
            .forEach(cb => cb.checked = false);
        }
      }
      
      // Update UI and reapply filters
      updateSelectedFilters();
      applyFilters();
    });
  });
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

  // Parlour Image
  const imageEl = cardWrapper.querySelector('#parlour-image, .parlour-image');
  const imageContainer = cardWrapper.querySelector('#parlour-image-div, .parlour-image-div');
  if (imageEl) {
    if (funeral["Image"] && funeral["Image"].toString().trim() !== "") {
      // Use GitHub Raw URL for efficiency
      const imageSrc = `https://raw.githubusercontent.com/Marcellolepoe/pgdata/main/images/${funeral["Image"]}`;
      imageEl.src = imageSrc;
      imageEl.alt = `${funeral["Funeral Parlour Name"] || 'Funeral Parlour'} - Photo`;
      imageEl.loading = "lazy"; // Performance optimization
      imageEl.style.display = '';
      
      // Show parent container
      if (imageContainer) imageContainer.style.display = '';
    } else {
      // Hide image and container when no image available
      imageEl.style.display = 'none';
      if (imageContainer) imageContainer.style.display = 'none';
    }
  }

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

// UPDATE PRICING BANDS
function updatePricingBands(filteredData, skipFilterReset = false) {
  if (!filteredData || filteredData.length === 0) {
    console.warn('No data provided to updatePricingBands');
    return;
  }

  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)",
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };

  // Get price keys based on day filter
  let priceKeys;
  if (Array.isArray(filters.days) && filters.days.length === 1) {
    priceKeys = [dayMap[filters.days[0]]];
  } else {
    priceKeys = Object.values(dayMap);
  }

  // Calculate stats from filtered data
  const prices = filteredData
    .flatMap(item =>
      priceKeys.map(k => {
        const raw = item[k] || "";
        return parseFloat(raw.toString().replace(/[^\d.]/g, ""));
      })
    )
    .filter(p => !isNaN(p) && p > 0);

  if (prices.length === 0) {
    console.warn('No valid prices found in filtered data');
    return;
  }

  const sorted = prices.sort((a, b) => a - b);
  const currentStats = {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    p33: sorted[Math.floor(sorted.length * 0.33)],
    p66: sorted[Math.floor(sorted.length * 0.66)]
  };

  // Initialize original stats on first run
  if (!window.priceStats.original) {
    window.priceStats.original = currentStats;
  }

  // Store these stats as the last non-price filtered stats
  window.priceStats.lastNonPriceFiltered = currentStats;

  // Always use these stats for display (they represent the non-price filtered state)
  updateTextForAll(".lowest-price-display", currentStats.min);
  updateTextForAll(".lower-band-range", currentStats.p33);
  updateTextForAll(".median-price-display", currentStats.median);
  updateTextForAll(".upper-band-range", currentStats.p66);
  updateTextForAll(".highest-price-display", currentStats.max);

  // Update visual bands using these stats
  updatePriceBandsVisual(currentStats.min, currentStats.p33, currentStats.p66, currentStats.max);

  // Store current stats for slider operations
  window.sliderMapping = currentStats;

  // Reset price filter range to match the current non-price filtered data range
  if (!skipFilterReset) {
    filters.priceMin = currentStats.min;
    filters.priceMax = currentStats.max;
    filters.priceBand = []; // Clear any band selection
    
    activePriceFilter = {
      type: null,
      value: null,
      positions: { min: 0, max: 100 },
      values: { min: currentStats.min, max: currentStats.max }
    };
  }
}

// 1. Add a logUpdate helper
function logUpdate(context, details) {
  console.log(`[LOG] ${context}:`, details);
}

// 2. Refactor applyFilters to only call updatePricingBands on non-price filter changes
function applyFilters(skipBandReset = false) {
  if (!window.funeralData || window.funeralData.length === 0) {
    console.warn('No funeral data available for filtering');
    return;
  }

  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)", 
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };

  // Start with all data
  let filteredData = window.funeralData;

  // Apply search filter
  if (filters.searchTerm && filters.searchTerm.trim() !== "") {
    filteredData = filteredData.filter(item => {
      const name = (item["Funeral Parlour Name"] || "").toLowerCase();
      return name.includes(filters.searchTerm.toLowerCase());
    });
  }

  // Apply day filters
  if (filters.days && filters.days.length > 0) {
    filteredData = filteredData.filter(item => {
      return filters.days.some(day => {
        const key = dayMap[day];
        const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
        return !isNaN(price) && price > 0;
      });
    });
  }

  // Apply other category filters
  const categoryFilters = ['location', 'casket', 'tentage', 'catering', 'hearse', 'personnel', 'monks'];

  categoryFilters.forEach(category => {
    if (filters[category] && filters[category].length > 0) {
      const fieldName = filterKeyMap[category];
      if (fieldName) {
        filteredData = filteredData.filter(item => {
          const value = (item[fieldName] || "").toString().toLowerCase();
          return filters[category].some(filterValue => 
            value.includes(filterValue.toLowerCase())
          );
        });
      }
    }
  });

  // Apply price filters (simple range check)
  if (filters.priceMin || filters.priceMax) {
    filteredData = filteredData.filter(item => {
      const selectedDays = filters.days && filters.days.length > 0 ? filters.days : ['1','2','3','4','5','6','7'];
      
      const prices = selectedDays.map(day => {
        const key = dayMap[day];
        const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
        return isNaN(price) ? null : price;
      }).filter(p => p !== null);

      if (prices.length === 0) return false;

      return prices.some(price => {
        const meetsMin = !filters.priceMin || price >= filters.priceMin;
        const meetsMax = !filters.priceMax || price <= filters.priceMax;
        return meetsMin && meetsMax;
      });
    });
  }

  // Update result counts
  const allEl = document.getElementById("all-results");
  const showEl = document.getElementById("showed-results");
  if (allEl) allEl.textContent = window.funeralData.length;
  if (showEl) showEl.textContent = filteredData.length;

  // Reset to first page
  currentPage = 1;
  
  // Display results
  paginateResults(filteredData);
  
  console.log(`✅ Filters applied: ${filteredData.length} of ${window.funeralData.length} results`);
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
  logFilterState('Before Clear Price Filter');
  
  // Get the current filtered stats with safeguard
  const stats = safeGetPriceStats();
  if (!stats) {
    console.warn('Cannot clear price filter - missing stats');
    return;
  }

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

  // Update UI
  updatePriceFilterUI();
  
  // Ensure we're using the correct stats
  window.sliderMapping = stats;

  logFilterState('After Clear Price Filter');
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

// Helper function to get filtered data excluding price filters
function getFilteredDataExcludingPrice() {
  if (!window.funeralData || window.funeralData.length === 0) {
    return [];
  }

  const dayMap = {
    "1": "Available Duration (1 Day)",
    "2": "Available Duration (2 Day)", 
    "3": "Available Duration (3 Days)",
    "4": "Available Duration (4 Days)",
    "5": "Available Duration (5 Days)",
    "6": "Available Duration (6 Days)",
    "7": "Available Duration (7 Days)"
  };

  // Start with all data
  let filteredData = window.funeralData;

  // Apply search filter
  if (filters.searchTerm && filters.searchTerm.trim() !== "") {
    filteredData = filteredData.filter(item => {
      const name = (item["Funeral Parlour Name"] || "").toLowerCase();
      return name.includes(filters.searchTerm.toLowerCase());
    });
  }

  // Apply day filters
  if (filters.days && filters.days.length > 0) {
    filteredData = filteredData.filter(item => {
      return filters.days.some(day => {
        const key = dayMap[day];
        const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
        return !isNaN(price) && price > 0;
      });
    });
  }

  // Apply other category filters (excluding price filters)
  const categoryFilters = ['location', 'casket', 'tentage', 'catering', 'hearse', 'personnel', 'monks'];

  categoryFilters.forEach(category => {
    if (filters[category] && filters[category].length > 0) {
      const fieldName = filterKeyMap[category];
      if (fieldName) {
        filteredData = filteredData.filter(item => {
          const value = (item[fieldName] || "").toString().toLowerCase();
          return filters[category].some(filterValue => 
            value.includes(filterValue.toLowerCase())
          );
        });
      }
    }
  });

  return filteredData;
}

// Helper function to update price filter UI elements
function updatePriceFilterUI() {
  // Update any price filter UI elements if needed
  // This function is called when price filters are cleared
  updateSelectedFilters();
}