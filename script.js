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
  priceBand: []
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

// Price calculation safeguards
function safeGetPriceStats() {
  const stats = window.priceStats?.lastNonPriceFiltered || window.priceStats?.original;
  if (!stats) {
    return null;
  }
  
  if (!stats.min || !stats.max || !stats.p33 || !stats.p66) {
    return null;
  }
  
  return stats;
}

// Helper function for piecewise percentile to value conversion
function piecewisePercentileToValue(fraction, min, p33, p66, max) {
  if (!min || !max || !p33 || !p66) {
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

async function initializePage() {
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
    priceBand: []
  };

  const requiredElements = [
    "funeral-cards-container",
    "price-band-bar"
  ];
  
  const missingElements = requiredElements.filter(id => !document.getElementById(id));
  if (missingElements.length > 0) {
    return;
  }

  // Load data immediately without artificial delay
  try {
    await fetchFuneralData();
    setupFilters();
    getFiltersFromURL();
    updateSelectedFilters();
    
    const sortOptions = [
      "price-asc", "price-desc",
      "google-rating-desc", "facebook-rating-desc",
      "google-reviews-desc", "facebook-reviews-desc"
    ];
    sortOptions.forEach(sortValue => {
      // Try multiple selection methods
      let elements = [document.getElementById(sortValue)].filter(el => el !== null);
      
      if (elements.length === 0) {
        elements = Array.from(document.querySelectorAll(`[data-sort="${sortValue}"]`));
      }
      
      if (elements.length === 0) {
        elements = Array.from(document.querySelectorAll(`.${sortValue}`));
      }
      
      elements.forEach(el => {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          filters.sortBy = sortValue;
          updateSelectedFilters();
          applyFilters();
        });
      });
    });
  } catch (error) {
    // Error during page initialization
  }
}

// Inject CSS styles for price bands and pagination
function injectStyles() {
  const styles = `
    /* Price Band Filter Styles */
    #band-lower,
    #band-middle,
    #band-upper {
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
    }

    #band-lower:hover,
    #band-middle:hover,
    #band-upper:hover {
      opacity: 0.8;
      transform: translateY(-1px);
    }

    #band-lower.active,
    #band-middle.active,
    #band-upper.active {
      border-color: #007bff;
      box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
      background-color: rgba(0, 123, 255, 0.1);
    }

    /* Use existing pagination styles */

    /* Loading Indicator */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Filter tag styling with remove buttons */
    .filter-tag {
      display: inline-flex !important;
      align-items: center;
      background-color: transparent;
      border: none;
      border-radius: 0;
      padding: 1px 4px;
      margin: 1px 2px;
      font-size: 14px;
      line-height: 1.1;
    }

    .filter-content {
      margin-right: 6px;
    }

    .filter-remove-btn {
      background: none;
      border: none;
      color: #6c757d;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      line-height: 1;
      padding: 0;
      margin: 0;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .filter-remove-btn:hover {
      background-color: #dc3545;
      color: white;
    }

    .filter-separator {
      color: #6c757d;
      margin: 0 4px;
    }

    /* Selected filters container styling */
    #selected-filters {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: flex-start !important;
      gap: 4px !important;
      min-height: 40px !important;
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    /* Force height expansion even more aggressively */
    #selected-filters[style*="height"] {
      height: auto !important;
      max-height: none !important;
      min-height: auto !important;
    }
    
    /* Override any grid display that might be hiding the filters */
    #selected-filters.selected-filters,
    .selected-filters {
      display: flex !important;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    
    /* Ensure filter tags are visible in any layout */
    .filter-tag {
      display: inline-flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: relative !important;
      z-index: 1000 !important;
      background: transparent !important;
      border: none !important;
    }
    
    /* Force selected filters to be visible regardless of grid settings */
    #selected-filters * {
      display: inline-flex !important;
      visibility: visible !important;
    }
    
    /* Override any webflow grid that might be hiding content */
    .w-layout-grid #selected-filters,
    .w-layout-grid .selected-filters {
      display: flex !important;
      grid-template-columns: none !important;
      grid-template-rows: none !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    /* Ensure parent containers allow vertical expansion */
    #selected-filters,
    .selected-filters {
      grid-row: auto !important;
      grid-column: auto !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
    }
    
    /* Force expansion on any parent grid containers */
    #selected-filters:parent,
    .selected-filters:parent,
    .w-layout-grid:has(#selected-filters),
    .w-layout-grid:has(.selected-filters) {
      height: auto !important;
      max-height: none !important;
      grid-auto-rows: auto !important;
      grid-template-rows: auto !important;
    }
    
    /* Aggressive overrides for stubborn Webflow containers */
    [class*="grid"]:has(#selected-filters),
    [class*="grid"]:has(.selected-filters),
    [id*="grid"]:has(#selected-filters),
    [id*="grid"]:has(.selected-filters) {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      display: grid !important;
      grid-auto-rows: auto !important;
    }
    
    /* Force any parent containers to expand */
    #selected-filters,
    .selected-filters {
      position: relative !important;
      z-index: 999 !important;
    }
    
    /* Override Webflow's default grid constraints more aggressively */
    .w-layout-grid,
    [class*="w-layout"],
    [class*="grid"] {
      grid-template-rows: auto !important;
      grid-auto-rows: auto !important;
      height: auto !important;
      min-height: auto !important;
      max-height: none !important;
    }
    
    /* Ensure filter containers don't clip content */
    #selected-filters,
    .selected-filters,
    #selected-filters *,
    .selected-filters * {
      overflow: visible !important;
    }
  `;

  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

// Performance optimization utilities
function initializePerformanceOptimizations() {
  // Create loading indicator if it doesn't exist
  function createLoadingIndicator() {
    if (document.getElementById('loading-indicator')) return;
    
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        flex-direction: column;
      ">
        <div style="
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <p style="margin-top: 15px; font-family: Arial, sans-serif; color: #666;">
          Loading funeral services...
        </p>
      </div>
    `;
    document.body.appendChild(loadingDiv);
  }

  // Performance monitoring
  let performanceMetrics = {
    dataFetchTime: 0,
    renderTime: 0,
    filterTime: 0
  };

  function trackPerformance(operation, fn) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    performanceMetrics[operation] = end - start;
    return result;
  }

  // Image optimization
  function optimizeImages() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.loading) {
        img.loading = 'lazy';
      }
      
      // Add error handling for broken images
      img.onerror = function() {
        this.style.display = 'none';
      };
    });
  }

  // Memory cleanup for large datasets
  function cleanupMemory() {
    // Clear any cached DOM elements that are no longer needed
    const unusedElements = document.querySelectorAll('[data-cleanup="true"]');
    unusedElements.forEach(el => el.remove());
    
    // Force garbage collection hint (if available)
    if (window.gc) {
      window.gc();
    }
  }

  // Prefetch critical resources
  function prefetchResources() {
    const criticalImages = [
      'https://cdn.prod.website-files.com/66343534ea61f97f0e1a4dd7/66423ee2f290eb7af2024d7f_Untitled%20design%20(4).png'
    ];
    
    criticalImages.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }

  // Service Worker registration
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Inline service worker code
      const swCode = `
        const CACHE_NAME = 'funeral-directory-v1';
        const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

        const urlsToCache = [
          'https://raw.githubusercontent.com/Marcellolepoe/pgdata/main/cleaned_buddhist_funeral_directory.json',
          'https://cdn.prod.website-files.com/66343534ea61f97f0e1a4dd7/66423ee2f290eb7af2024d7f_Untitled%20design%20(4).png'
        ];

        self.addEventListener('install', event => {
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
              return cache.addAll([]);
            }).catch(error => {
            })
          );
        });

        self.addEventListener('fetch', event => {
          if (event.request.method !== 'GET') return;
          
          if (event.request.url.includes('cleaned_buddhist_funeral_directory.json')) {
            event.respondWith(
              caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                  if (cachedResponse) {
                    const cachedTimestamp = cachedResponse.headers.get('sw-cached-time');
                    if (cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < CACHE_EXPIRY) {
                      return cachedResponse;
                    }
                  }
                  
                  return fetch(event.request).then(response => {
                    if (response.status === 200) {
                      const responseToCache = response.clone();
                      const headers = new Headers(responseToCache.headers);
                      headers.append('sw-cached-time', Date.now().toString());
                      
                      const modifiedResponse = new Response(responseToCache.body, {
                        status: responseToCache.status,
                        statusText: responseToCache.statusText,
                        headers: headers
                      });
                      
                      cache.put(event.request, modifiedResponse);
                    }
                    return response;
                  }).catch(() => {
                    return cachedResponse || new Response('{"error": "Network unavailable"}', {
                      status: 503,
                      headers: { 'Content-Type': 'application/json' }
                    });
                  });
                });
              })
            );
            return;
          }
          
          event.respondWith(
            caches.match(event.request).then(response => {
              return response || fetch(event.request);
            })
          );
        });

        self.addEventListener('activate', event => {
          event.waitUntil(
            caches.keys().then(cacheNames => {
              return Promise.all(
                cacheNames.map(cacheName => {
                  if (cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                  }
                })
              );
            })
          );
        });
      `;

      // Create blob URL for service worker
      const blob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);
      
      navigator.serviceWorker.register(swUrl)
        .then(registration => {
        })
        .catch(error => {
        });
    }
  }

  // Initialize optimizations
  createLoadingIndicator();
  prefetchResources();
  registerServiceWorker();
  
  // Optimize images after initial load
  setTimeout(() => {
    optimizeImages();
  }, 1000);
  
  // Cleanup memory periodically
  setInterval(cleanupMemory, 30000); // Every 30 seconds

  // Export functions for use
  window.performanceUtils = {
    trackPerformance,
    cleanupMemory,
    optimizeImages
  };
}

// Ensure we wait for DOM content to be loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    initializePerformanceOptimizations();
    initializePage();
  });
} else {
  injectStyles();
  initializePerformanceOptimizations();
  initializePage();
}

async function fetchFuneralData() {
  const jsonUrl = "https://raw.githubusercontent.com/Marcellolepoe/pgdata/main/cleaned_buddhist_funeral_directory.json";
  
  // Check cache first
  const cacheKey = 'funeral_data_cache';
  const cachedData = localStorage.getItem(cacheKey);
  const cacheTimestamp = localStorage.getItem(cacheKey + '_timestamp');
  const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  
  if (cachedData && cacheTimestamp && (Date.now() - parseInt(cacheTimestamp)) < cacheExpiry) {
    try {
      funeralData = JSON.parse(cachedData);
    } catch (e) {
      console.warn('Cache parse error, fetching fresh data');
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheKey + '_timestamp');
    }
  }
  
  if (!funeralData || funeralData.length === 0) {
    try {
      // Show loading indicator
      const loadingEl = document.getElementById('loading-indicator');
      if (loadingEl) loadingEl.style.display = 'block';
      
      const response = await fetch(jsonUrl, {
        headers: {
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });
      if (!response.ok) throw new Error("Failed to fetch data.");
      funeralData = await response.json();
      
      // Cache the data
      try {
        localStorage.setItem(cacheKey, JSON.stringify(funeralData));
        localStorage.setItem(cacheKey + '_timestamp', Date.now().toString());
      } catch (e) {
        console.warn('Failed to cache data:', e);
      }
    } catch (error) {
      console.error("❌ Error fetching funeral data:", error);
      throw error;
    }
  }
  
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

  // Hide loading indicator
  const loadingEl = document.getElementById('loading-indicator');
  if (loadingEl) loadingEl.style.display = 'none';
  
  // Update price displays with initial data
  updatePricingBands(funeralData, true);
  
  // Show all results initially (including those without prices)
  window.currentPage = 1; // Reset to first page
  renderResults(funeralData);
  
  // Then apply any URL parameters
  getFiltersFromURL();
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
    let searchTimeout;
    
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
    
    // Debounced search for better performance
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filters.searchTerm = this.value.trim().toLowerCase();
        updateSelectedFilters();
        applyFilters();
      }, 300); // Wait 300ms after user stops typing
    });
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const manualMaxInput = document.getElementById("price-input-max");
  if (manualMaxInput) {
    // Prevent form submission on Enter key
    manualMaxInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        // Optionally blur the input to indicate the action was handled
        manualMaxInput.blur();
        return false;
      }
    });
    
    // Handle input changes for filtering
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
  
  // Try to find sort elements by ID first, then by data attributes
  sortOptions.forEach(sortValue => {
    // Try ID first
    let elements = [document.getElementById(sortValue)].filter(el => el !== null);
    
    // If no ID found, try data attributes
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll(`[data-sort="${sortValue}"]`));
    }
    
    // If still no elements, try class-based selection
    if (elements.length === 0) {
      elements = Array.from(document.querySelectorAll(`.${sortValue}`));
    }
    
    if (elements.length === 0) {
      console.warn(`⚠️ No sort elements found for: ${sortValue}`);
      document.querySelectorAll('[id*="sort"], [class*="sort"]').forEach(el => {
      });
    }
    
    
    elements.forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        filters.sortBy = sortValue;
        
        const labelMap = {
          "price-asc": "Price ↑",
          "price-desc": "Price ↓",
          "google-rating-desc": "Google Reviews",
          "facebook-rating-desc": "Facebook Reviews",
          "google-reviews-desc": "#Google Reviews",
          "facebook-reviews-desc": "#FB Reviews"
        };
        
        // Update sort button label if it exists
        const sortLabel = document.getElementById("sort-button-label");
        if (sortLabel) sortLabel.textContent = labelMap[sortValue] || "Sort By";
        
        // Update selected filters
        updateSelectedFilters();
        applyFilters();
      });
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  const clearAllButton = document.getElementById("clear-all") || document.querySelector("button[data-action='clear-all']") || document.querySelector(".clear-all");
  if (clearAllButton) {
    clearAllButton.addEventListener("click", function (e) {
      e.preventDefault();
      
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
      filters.sortBy = "";
      
      // Reset all array filters
      Object.keys(filters).forEach(key => {
        if (Array.isArray(filters[key])) {
          filters[key] = [];
        }
      });
      
      // Reset sort button label
      const sortLabel = document.getElementById("sort-button-label");
      if (sortLabel) sortLabel.textContent = "Sort By";

      // Reset checkboxes
      document.querySelectorAll('.filter-checkbox input[type="checkbox"]')
        .forEach(cb => cb.checked = false);
      
      // Clear price max input
      const manualMaxInput = document.getElementById("price-input-max");
      if (manualMaxInput) manualMaxInput.value = "";
      
      // Clear price band visual states
      const priceBandElements = [
        { id: 'band-lower', value: 'lower' },
        { id: 'band-middle', value: 'middle' },
        { id: 'band-upper', value: 'upper' }
      ];
      
      priceBandElements.forEach(band => {
        const element = document.getElementById(band.id);
        if (element) {
          element.classList.remove('active');
        }
      });
      
      // Update UI and apply filters
      updateSelectedFilters();
      applyFilters();
    });
  } else {
    console.error("🚨 Clear All button not found! Check Webflow class name and ID.");
  }
});

function setupFilters() {
  // First, ensure all filter categories used in the DOM are initialized
  const allCategories = new Set();
  document.querySelectorAll(".filter-checkbox").forEach(label => {
    const category = label.dataset.category;
    if (category) {
      allCategories.add(category);
    }
  });
  
  // Initialize any missing categories
  allCategories.forEach(category => {
    if (!filters[category] || !Array.isArray(filters[category])) {
      filters[category] = [];
    }
  });
  
  
  document.querySelectorAll(".filter-checkbox input[type='checkbox']").forEach(checkbox => {
    const label = checkbox.closest(".filter-checkbox");
    if (!label) return;
    const category = label.dataset.category;
    const value = label.dataset.value;
    if (!category || !value) {
      return;
    }
    checkbox.addEventListener("change", function () {
      // Ensure the category exists as an array
      if (!filters[category] || !Array.isArray(filters[category])) {
        filters[category] = [];
      }
      
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
      updatePricingBands(nonPriceFiltered, true); // Skip filter reset to prevent unwanted price-max
      
      // Then apply all filters including price
      applyFilters();
    });
  });

  // Setup price band filters
  const priceBandElements = [
    { id: 'band-lower', value: 'lower' },
    { id: 'band-middle', value: 'middle' },
    { id: 'band-upper', value: 'upper' }
  ];

  priceBandElements.forEach(band => {
    const element = document.getElementById(band.id);
    if (element) {
      element.addEventListener('click', (e) => {
        e.preventDefault();
        const bandValue = band.value;
        
        // Ensure priceBand is initialized as an array
        if (!filters.priceBand || !Array.isArray(filters.priceBand)) {
          filters.priceBand = [];
        }
        
        // Toggle the band in the filter array
        
        if (!filters.priceBand.includes(bandValue)) {
          filters.priceBand.push(bandValue);
          element.classList.add('active');
        } else {
          filters.priceBand = filters.priceBand.filter(b => b !== bandValue);
          element.classList.remove('active');
        }
        
        
        updateSelectedFilters();
        
        // Note: Price bands should NOT update price displays
        // Price displays should always show original stats
        
        applyFilters();
      });
    } else {
      console.error(`❌ Price band element NOT found: ${band.id}`);
      document.querySelectorAll('[id*="band"], [class*="band"]').forEach(el => {
      });
    }
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
    }
  });
  
  // Handle price band filters separately
  filters.priceBand = params.get("priceBand") ? params.get("priceBand").split(",") : [];
  document.querySelectorAll(".filter-checkbox input[type='checkbox']").forEach(checkbox => {
    let category = checkbox.closest(".filter-checkbox")?.dataset.category;
    let selectedValue = checkbox.dataset.value;
    if (filters[category] && filters[category].includes(selectedValue)) {
      checkbox.checked = true;
    } else {
      checkbox.checked = false;
    }
  });

  // Update price band visual states
  const priceBandElements = [
    { id: 'band-lower', value: 'lower' },
    { id: 'band-middle', value: 'middle' },
    { id: 'band-upper', value: 'upper' }
  ];

  priceBandElements.forEach(band => {
    const element = document.getElementById(band.id);
    if (element) {
      if (filters.priceBand.includes(band.value)) {
        element.classList.add('active');
      } else {
        element.classList.remove('active');
      }
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
  
  // Debug: Find all possible selected filters containers
  
  // Check by ID
  const byId = document.getElementById("selected-filters");
  
  // Check by class
  const byClass = document.querySelectorAll('.selected-filters');
  byClass.forEach((el, index) => {
  });
  
  // Check for any element with "selected" in the ID or class
  const anySelected = document.querySelectorAll('[id*="selected"], [class*="selected"]');
  anySelected.forEach((el, index) => {
  });
  
  let selectedFiltersDiv = document.getElementById("selected-filters");
  
  // If element exists but is positioned too far down, try to find a better container
  if (selectedFiltersDiv) {
    const rect = selectedFiltersDiv.getBoundingClientRect();
    
    // If the element is way down the page, look for a better positioned alternative
    if (rect.top > window.innerHeight) {
      
      // Try to find an element with class "selected-filters" that's better positioned
      const alternativeContainers = document.querySelectorAll('.selected-filters');
      for (let container of alternativeContainers) {
        const containerRect = container.getBoundingClientRect();
        if (containerRect.top < window.innerHeight && containerRect.top > 0) {
          selectedFiltersDiv = container;
          // Give it an ID for future reference
          if (!container.id) container.id = 'selected-filters-active';
          break;
        }
      }
    }
  }
  
  if (!selectedFiltersDiv) {
    
    // Try to find by class
    const classElements = document.querySelectorAll('.selected-filters');
    if (classElements.length > 0) {
      selectedFiltersDiv = classElements[0];
      // Give it an ID for future reference
      if (!selectedFiltersDiv.id) {
        selectedFiltersDiv.id = 'selected-filters';
      }
    }
  }
  
  if (!selectedFiltersDiv) {
    console.error('❌ No selected filters container found at all');
    document.querySelectorAll('[id*="selected"], [class*="selected"]').forEach(el => {
    });
    return;
  }
  
  
  selectedFiltersDiv.innerHTML = "";
  let hasFilters = false;
  let tagCount = 0;

  // Helper to add a filter tag with remove button
  const addFilterTag = (label, value, category, filterValue = null) => {
    
    const filterTag = document.createElement("div");
    filterTag.classList.add("filter-tag");
    // Properly encode the filter value for HTML attribute
    const encodedFilterValue = filterValue ? filterValue.replace(/"/g, '&quot;') : '';
    
    filterTag.innerHTML = `
      <span class="filter-content">
        <strong>${label}:</strong> ${value}
      </span>
      <button class="filter-remove-btn" data-category="${category}" data-value="${encodedFilterValue}" aria-label="Remove ${label} filter">
        ×
      </button>
    `;
    
    // Add click handler for remove button
    const removeBtn = filterTag.querySelector('.filter-remove-btn');
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const rawFilterValue = e.target.getAttribute('data-value');
      const decodedFilterValue = rawFilterValue ? rawFilterValue.replace(/&quot;/g, '"') : '';
      removeFilter(category, decodedFilterValue);
    });
    
    selectedFiltersDiv.appendChild(filterTag);
    
    // Force visibility with JavaScript
    forceElementAndParentsVisibility(selectedFiltersDiv);
    forceElementVisibility(filterTag);
    
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
      addFilterTag('Price', `$${filters.priceMax.toLocaleString()} Max`, 'price', 'max');
    } else {
      addFilterTag('Price', `$${filters.priceMin.toLocaleString()} – $${filters.priceMax.toLocaleString()}`, 'price', 'range');
    }
  }

  // Handle other filters
  Object.keys(filters).forEach((category) => {
    if (category === 'priceMin' || category === 'priceMax' || category === 'searchTerm' || category === 'sortBy') return;
    const val = filters[category];
    if (Array.isArray(val) && val.length > 0) {
      let formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
      let formattedValues = val;
      
      // Special handling for price bands to capitalize properly
      if (category === 'priceBand') {
        formattedCategory = 'Price Band';
        formattedValues = val.map(v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase());
      }
      
      const jsonValue = JSON.stringify(val);
      addFilterTag(formattedCategory, formattedValues.join(", "), category, jsonValue);
    }
  });

  // Handle search term
  if (filters.searchTerm && filters.searchTerm.trim() !== "") {
    addFilterTag('Search', filters.searchTerm, 'searchTerm', filters.searchTerm);
  }

  // Handle sorting (moved outside hasFilters check so it shows even when no other filters are selected)
  if (filters.sortBy && filters.sortBy.trim() !== "") {
    const sortLabels = {
      "price-asc": "Price (Low to High)",
      "price-desc": "Price (High to Low)",
      "google-rating-desc": "Google Rating (High to Low)",
      "facebook-rating-desc": "Facebook Rating (High to Low)",
      "google-reviews-desc": "Google Reviews (Most to Least)",
      "facebook-reviews-desc": "Facebook Reviews (Most to Least)"
    };
    const sortLabel = sortLabels[filters.sortBy] || filters.sortBy;
    addFilterTag('Sort', sortLabel, 'sortBy', filters.sortBy);
    hasFilters = true; // Mark that we have at least one item to display
  }


  if (!hasFilters) {
    selectedFiltersDiv.innerHTML = `<p style="color: gray;">No filters selected.</p>`;
  } else {
    // Final force visibility
    forceElementAndParentsVisibility(selectedFiltersDiv);
    selectedFiltersDiv.querySelectorAll('.filter-tag').forEach(tag => {
      forceElementVisibility(tag);
    });
    
    // Ensure the container is visible and properly styled (but keep it in its natural position)
    setTimeout(() => {
      const rect = selectedFiltersDiv.getBoundingClientRect();
      
      // Reset any previous fixed positioning
      if (selectedFiltersDiv.style.position === 'fixed') {
        selectedFiltersDiv.style.position = '';
        selectedFiltersDiv.style.top = '';
        selectedFiltersDiv.style.left = '';
        selectedFiltersDiv.style.right = '';
        selectedFiltersDiv.style.width = '';
        selectedFiltersDiv.style.height = '';
      }
      
      // Ensure it has proper styling but stays in its natural position
      selectedFiltersDiv.style.display = 'flex';
      selectedFiltersDiv.style.visibility = 'visible';
      selectedFiltersDiv.style.opacity = '1';
      selectedFiltersDiv.style.flexWrap = 'wrap';
      selectedFiltersDiv.style.alignItems = 'flex-start';
      selectedFiltersDiv.style.gap = '4px';
      selectedFiltersDiv.style.minHeight = '40px';
      selectedFiltersDiv.style.height = 'auto';
      selectedFiltersDiv.style.maxHeight = 'none';
      selectedFiltersDiv.style.minHeight = 'auto';
      selectedFiltersDiv.style.overflow = 'visible';
      
      // Force height with important styles
      selectedFiltersDiv.style.setProperty('height', 'auto', 'important');
      selectedFiltersDiv.style.setProperty('max-height', 'none', 'important');
      selectedFiltersDiv.style.setProperty('min-height', 'auto', 'important');
      
      // Aggressively force parent containers to expand
      let parent = selectedFiltersDiv.parentElement;
      let level = 0;
      while (parent && level < 5) {
        const computedStyle = window.getComputedStyle(parent);
        
        // Force height expansion
        parent.style.height = 'auto';
        parent.style.maxHeight = 'none';
        parent.style.minHeight = 'auto';
        parent.style.overflow = 'visible';
        
        // For grid containers, ensure auto rows
        if (computedStyle.display.includes('grid') || parent.classList.toString().includes('grid')) {
          parent.style.gridTemplateRows = 'auto';
          parent.style.gridAutoRows = 'auto';
        }
        
        parent = parent.parentElement;
        level++;
      }
      
    }, 100);
  }
}

// Force element visibility by directly setting styles
function forceElementVisibility(element) {
  if (!element) return;
  
  // Force all display and visibility properties
  element.style.display = 'flex';
  element.style.visibility = 'visible';
  element.style.opacity = '1';
  element.style.position = 'relative';
  element.style.zIndex = '9999';
  element.style.background = 'transparent';
  element.style.border = 'none';
  element.style.padding = '4px';
  element.style.margin = '2px';
  element.style.minHeight = 'auto';
  element.style.maxHeight = 'none';
  element.style.width = 'auto';
  element.style.height = 'auto';
  element.style.overflow = 'visible';
  element.style.flexWrap = 'wrap';
  
}

// Enhanced force visibility that also fixes parent issues
function forceElementAndParentsVisibility(element) {
  if (!element) return;
  
  
  // First force the element itself
  forceElementVisibility(element);
  
  // Then check and fix parent elements up to 3 levels
  let currentElement = element.parentElement;
  let level = 1;
  while (currentElement && level <= 3) {
    const computedStyle = window.getComputedStyle(currentElement);
    
    // If parent has problematic display values, fix them
    if (computedStyle.display === 'none' || 
        computedStyle.visibility === 'hidden' || 
        computedStyle.opacity === '0' ||
        parseFloat(computedStyle.width) === 0 ||
        parseFloat(computedStyle.height) === 0) {
      
      
      // Check if it's a grid container and preserve grid layout while allowing expansion
      if (computedStyle.display.includes('grid') || currentElement.classList.toString().includes('grid')) {
        currentElement.style.display = 'grid';
        currentElement.style.gridAutoRows = 'auto';
        currentElement.style.gridTemplateRows = 'auto';
      } else {
        currentElement.style.display = 'block';
      }
      
      currentElement.style.visibility = 'visible';
      currentElement.style.opacity = '1';
      currentElement.style.minWidth = 'auto';
      currentElement.style.minHeight = 'auto';
      currentElement.style.width = 'auto';
      currentElement.style.height = 'auto';
      currentElement.style.maxHeight = 'none';
      currentElement.style.overflow = 'visible';
      
      // If it's a grid container, make sure it doesn't collapse
      if (computedStyle.display.includes('grid')) {
        currentElement.style.gridTemplateColumns = 'none';
        currentElement.style.gridTemplate = 'none';
        currentElement.style.display = 'block';
      }
    }
    
    currentElement = currentElement.parentElement;
    level++;
  }
}

// Function to remove individual filters
function removeFilter(category, filterValue) {
  if (category === 'price') {
    // Reset price filters to original range
    if (window.priceStats && window.priceStats.original) {
      filters.priceMin = window.priceStats.original.min;
      filters.priceMax = window.priceStats.original.max;
    }
    
    // Clear price max input
    const manualMaxInput = document.getElementById("price-input-max");
    if (manualMaxInput) manualMaxInput.value = "";
    
  } else if (category === 'searchTerm') {
    filters.searchTerm = "";
    
    // Clear search input
    const searchInput = document.getElementById("funeral-parlour-search");
    if (searchInput) searchInput.value = "";
    
  } else if (category === 'sortBy') {
    filters.sortBy = "";
    
    // Reset sort button label
    const sortLabel = document.getElementById("sort-button-label");
    if (sortLabel) sortLabel.textContent = "Sort By";
    
    
  } else if (Array.isArray(filters[category])) {
    // Handle array filters (location, casket, etc.)
    if (filterValue) {
      try {
        const valuesToRemove = JSON.parse(filterValue);
        filters[category] = [];
        
        // Update corresponding checkboxes using multiple selection methods
        valuesToRemove.forEach(value => {
          
          // Method 1: Look for input inside container with data attributes (correct approach)
          let checkboxes = document.querySelectorAll(`[data-category="${category}"][data-value="${value}"] input[type="checkbox"]`);
          
          // Method 2: Try direct attribute matching on input (in case data is on input)
          if (checkboxes.length === 0) {
            checkboxes = document.querySelectorAll(`input[type="checkbox"][data-category="${category}"][data-value="${value}"]`);
          }
          
          // Method 3: Try the .filter-checkbox class approach
          if (checkboxes.length === 0) {
            checkboxes = document.querySelectorAll(`.filter-checkbox[data-category="${category}"][data-value="${value}"] input[type="checkbox"]`);
          }
          
          // Method 4: Manual search through all checkboxes
          if (checkboxes.length === 0) {
            const allInputs = document.querySelectorAll(`input[type="checkbox"]`);
            
            checkboxes = Array.from(allInputs).filter(input => {
              const container = input.closest('[data-category]');
              if (container) {
                const containerCategory = container.getAttribute('data-category');
                const containerValue = container.getAttribute('data-value');
                return containerCategory === category && containerValue === value;
              }
              return false;
            });
          }
          
          if (checkboxes.length === 0) {
            console.warn(`⚠️ No checkboxes found for ${category}:${value}`);
            // Debug: Show all checkboxes in this category
            const allInCategory = document.querySelectorAll(`input[type="checkbox"][data-category="${category}"]`);
            allInCategory.forEach((cb, index) => {
            });
          } else {
          }
          
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            
            // Trigger change event to ensure any listeners are notified
            const changeEvent = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
          });
        });
        
        // Handle price band visual states - updated for data attributes
        if (category === 'priceBand') {
          valuesToRemove.forEach(value => {
            // Try both ID-based and data-attribute-based selection
            let elements = [document.getElementById(`band-${value}`)].filter(el => el !== null);
            
            if (elements.length === 0) {
              elements = Array.from(document.querySelectorAll(`[data-category="priceBand"][data-value="${value}"]`));
            }
            
            elements.forEach(element => {
              if (element) {
                element.classList.remove('active');
              }
            });
          });
        }
        
      } catch (e) {
        console.error(`❌ Failed to parse JSON filterValue: "${filterValue}". Error:`, e);
        
        // If it looks like a simple value (not JSON), try to use it directly
        if (filterValue && !filterValue.startsWith('[') && !filterValue.startsWith('{')) {
          const valuesToRemove = [filterValue];
          
          // Remove the specific value instead of clearing all
          if (filters[category] && Array.isArray(filters[category])) {
            filters[category] = filters[category].filter(v => !valuesToRemove.includes(v));
          }
          
          // Find and uncheck the specific checkbox
          valuesToRemove.forEach(value => {
            const checkboxes = document.querySelectorAll(`input[type="checkbox"][data-category="${category}"][data-value="${value}"]`);
            checkboxes.forEach(checkbox => {
              checkbox.checked = false;
              const changeEvent = new Event('change', { bubbles: true });
              checkbox.dispatchEvent(changeEvent);
            });
          });
        } else {
          // Fallback: clear all values for this category
          filters[category] = [];
          
                   // Try multiple methods to find and uncheck all checkboxes for this category
         let allCheckboxes = document.querySelectorAll(`[data-category="${category}"] input[type="checkbox"]`);
         if (allCheckboxes.length === 0) {
           allCheckboxes = document.querySelectorAll(`input[type="checkbox"][data-category="${category}"]`);
         }
         if (allCheckboxes.length === 0) {
           allCheckboxes = document.querySelectorAll(`.filter-checkbox[data-category="${category}"] input[type="checkbox"]`);
         }
          
          allCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
            const changeEvent = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
          });
          
        }
      }
    }
  }
  
  // Update UI and apply filters
  updateSelectedFilters();
  
  // Apply non-price filters first and update price stats if needed
  if (category !== 'price' && category !== 'sortBy') {
    const nonPriceFiltered = getFilteredDataExcludingPrice();
    updatePricingBands(nonPriceFiltered, true);
  }
  
  applyFilters();
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
    
  let hasAnyPriceInfo = false;
  
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
          hasAnyPriceInfo = true;
        } else {
          priceDiv.style.display = 'none';
        }
      } else {
        priceDiv.style.display = 'none';
      }
    }
  }
  
  // If no price information is available for any selected days, show a default message
  if (!hasAnyPriceInfo && selectedDays.length > 0) {
    // Find and hide the pricing section entirely
    // Try different approaches to find the pricing container
    const pricingSection = cardWrapper.querySelector('#day1-price-div')?.parentElement ||
                          cardWrapper.querySelector('[id*="price"]')?.parentElement?.parentElement;
    
    if (pricingSection) {
      // Hide the entire pricing section
      pricingSection.style.display = 'none';
      
      // Create a replacement message
      const noPriceDiv = document.createElement('div');
      noPriceDiv.style.fontStyle = 'italic';
      noPriceDiv.style.fontWeight = 'normal';
      noPriceDiv.style.padding = '10px 0';
      noPriceDiv.textContent = 'No price information available';
      
      // Insert the message after the hidden pricing section
      pricingSection.parentElement.insertBefore(noPriceDiv, pricingSection.nextSibling);
    } else {
      // Fallback: hide all day divs and use first one for message
      for (let i = 1; i <= 7; i++) {
        const dayDiv = cardWrapper.querySelector(`#day${i}-price-div`);
        if (dayDiv) {
          dayDiv.style.display = 'none';
        }
      }
      
      const firstPriceEl = cardWrapper.querySelector(`#day${selectedDays[0]}-price`);
      const firstPriceDiv = cardWrapper.querySelector(`#day${selectedDays[0]}-price-div`);
      if (firstPriceEl && firstPriceDiv) {
        firstPriceEl.textContent = "No price information available";
        firstPriceEl.style.fontStyle = "italic";
        firstPriceEl.style.fontWeight = "normal";
        firstPriceDiv.style.display = '';
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
        descEl.style.fontStyle = "normal";
        descEl.style.color = "";
        parentDiv.style.display = '';
      } else {
        // Hide categories without information
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

// RENDER RESULTS (Optimized with pagination)
function renderResults(filteredData) {
  const container = document.getElementById("funeral-cards-container");
  const template = document.getElementById("funeral-card-wrapper");
  if (!container || !template) {
    return;
  }
  
  // Performance optimization: Use pagination for large datasets
  const ITEMS_PER_PAGE = 20; // Show only 20 items at a time
  const currentPage = window.currentPage || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length);
  const pageData = filteredData.slice(startIndex, endIndex);
  
  // Remove all previously rendered cards except the template
  Array.from(container.children).forEach(child => {
    if (child !== template) container.removeChild(child);
  });
  template.style.display = "none";
  
  // Use document fragment for batch DOM updates
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < pageData.length; i++) {
    const data = pageData[i];
    const card = template.cloneNode(true);
    card.id = "";
    card.style.display = "";
    populateFuneralCard(card, data);
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
  
  // Update result counts
  const showEl = document.getElementById("showed-results");
  if (showEl) showEl.textContent = filteredData.length;
  
  // Add pagination controls if needed
  if (filteredData.length > ITEMS_PER_PAGE) {
    renderPaginationControls(Math.ceil(filteredData.length / ITEMS_PER_PAGE), filteredData);
  } else {
    // Hide pagination when not needed
    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
      paginationContainer.style.display = 'none';
    }
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
  const elements = document.querySelectorAll(selector);
  
  if (elements.length === 0) {
    console.warn(`⚠️ No elements found with selector "${selector}"`);
    const partialMatch = selector.replace('.', '');
    document.querySelectorAll(`[class*="${partialMatch}"]`).forEach(el => {
    });
  }
  
  elements.forEach((element, index) => {
    if (element) {
      element.textContent = value.toLocaleString();
    }
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
  updateTextForAll(".middle-price-display", currentStats.median);
  updateTextForAll(".upper-band-range", currentStats.p66);
  updateTextForAll(".middle-band-range", currentStats.p66);
  updateTextForAll(".highest-price-display", currentStats.max);
  

  // Update visual bands using these stats
  updatePriceBandsVisual(currentStats.min, currentStats.p33, currentStats.p66, currentStats.max);

  // Store current stats for slider operations
  window.sliderMapping = currentStats;

  // Don't automatically reset price filters - this was causing unwanted price-max to appear
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

  // Apply price band filters
  if (filters.priceBand && filters.priceBand.length > 0) {
    const stats = window.priceStats?.original || getStatsFromData(filteredData);
    if (stats) {
      filteredData = filteredData.filter(item => {
        const selectedDays = filters.days && filters.days.length > 0 ? filters.days : ['1','2','3','4','5','6','7'];
        
        const prices = selectedDays.map(day => {
          const key = dayMap[day];
          const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
          return isNaN(price) ? null : price;
        }).filter(p => p !== null);

        if (prices.length === 0) return false;

        return prices.some(price => {
          return filters.priceBand.some(band => {
            switch(band.toLowerCase()) {
              case 'lower':
                return price >= stats.min && price <= stats.p33;
              case 'middle':
                return price > stats.p33 && price <= stats.p66;
              case 'upper':
                return price > stats.p66 && price <= stats.max;
              default:
                return false;
            }
          });
        });
      });
    }
  }

  // Apply price range filters (priceMin/priceMax)
  if (filters.priceMin || filters.priceMax) {
    filteredData = filteredData.filter(item => {
      const selectedDays = filters.days && filters.days.length > 0 ? filters.days : ['1','2','3','4','5','6','7'];
      
      const prices = selectedDays.map(day => {
        const key = dayMap[day];
        const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
        return isNaN(price) ? null : price;
      }).filter(p => p !== null);

      // If no prices available but not filtering by price, include the item
      if (prices.length === 0) {
        // Only exclude if we're actively filtering by price and the item has no prices
        const hasActivePriceFilter = (filters.priceMin && filters.priceMin > (window.priceStats?.original?.min || 0)) ||
                                    (filters.priceMax && filters.priceMax < (window.priceStats?.original?.max || 999999));
        return !hasActivePriceFilter;
      }

      return prices.some(price => {
        const meetsMin = !filters.priceMin || price >= filters.priceMin;
        const meetsMax = !filters.priceMax || price <= filters.priceMax;
        return meetsMin && meetsMax;
      });
    });
  }

  // Apply sorting
  if (filters.sortBy && filters.sortBy.trim() !== "") {
    filteredData = [...filteredData].sort((a, b) => {
      switch(filters.sortBy) {
        case 'price-asc':
          return getLowestPrice(a) - getLowestPrice(b);
        case 'price-desc':
          return getLowestPrice(b) - getLowestPrice(a);
        case 'google-rating-desc':
          return parseFloat(b["Google Rating"] || 0) - parseFloat(a["Google Rating"] || 0);
        case 'facebook-rating-desc':
          return parseFloat(b["Facebook Rating"] || 0) - parseFloat(a["Facebook Rating"] || 0);
        case 'google-reviews-desc':
          return parseInt(b["Google Reviews"] || 0) - parseInt(a["Google Reviews"] || 0);
        case 'facebook-reviews-desc':
          return parseInt(b["Facebook Reviews"] || 0) - parseInt(a["Facebook Reviews"] || 0);
        default:
          return 0;
      }
    });
  }

  // Update result counts
  const allEl = document.getElementById("all-results");
  const showEl = document.getElementById("showed-results");
  if (allEl) allEl.textContent = window.funeralData.length;
  if (showEl) showEl.textContent = filteredData.length;

  // Reset to first page when applying new filters
  window.currentPage = 1;
  
  // Display results
  paginateResults(filteredData);
  
}

// Helper function to get lowest price for sorting
function getLowestPrice(item) {
  const priceKeys = [
    "Available Duration (1 Day)",
    "Available Duration (2 Day)",
    "Available Duration (3 Days)",
    "Available Duration (4 Days)",
    "Available Duration (5 Days)",
    "Available Duration (6 Days)",
    "Available Duration (7 Days)"
  ];
  
  const prices = priceKeys.map(key => {
    const price = parseFloat((item[key] || "").toString().replace(/[^\d.]/g, ""));
    return isNaN(price) ? null : price;
  }).filter(p => p !== null);
  
  return prices.length > 0 ? Math.min(...prices) : Infinity;
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
function renderPaginationControls(totalPages, filteredData) {
  const container = document.getElementById('pagination-container') || document.querySelector('.pagination-container');
  if (!container) {
    // Create pagination container if it doesn't exist
    const paginationDiv = document.createElement('div');
    paginationDiv.id = 'pagination-container';
    
    const resultsContainer = document.getElementById("funeral-cards-container");
    if (resultsContainer && resultsContainer.parentNode) {
      resultsContainer.parentNode.insertBefore(paginationDiv, resultsContainer.nextSibling);
    }
  }
  
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  
  paginationContainer.innerHTML = '';
  
  if (totalPages <= 1) {
    paginationContainer.style.display = 'none';
    return;
  }
  
  paginationContainer.style.display = 'flex';
  
  // Previous button
  if (window.currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.className = 'pagination-button-inactive';
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentPage--;
      renderResults(filteredData);
    });
    paginationContainer.appendChild(prevBtn);
  }
  
  // Page numbers (show all pages)
  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === window.currentPage) {
      btn.className = 'pagination-button-active';
    } else {
      btn.className = 'pagination-button-inactive';
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.currentPage !== i) {
        window.currentPage = i;
        renderResults(filteredData);
      }
    });
    paginationContainer.appendChild(btn);
  }
  
  // Next button
  if (window.currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.className = 'pagination-button-inactive';
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.currentPage++;
      renderResults(filteredData);
    });
    paginationContainer.appendChild(nextBtn);
  }
}

function paginateResults(filteredData) {
  // Set current page data for renderResults to use
  window.currentFilteredData = filteredData;
  window.currentPage = window.currentPage || 1;
  
  // Batch DOM updates for performance
  requestAnimationFrame(() => {
    renderResults(filteredData);
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





// Enhanced force visibility that also fixes parent issues
function forceElementAndParentsVisibility(element) {
  if (!element) return;
  
  
  // First force the element itself
  forceElementVisibility(element);
  
  // Then check and fix parent elements up to 3 levels
  let currentElement = element.parentElement;
  let level = 1;
  while (currentElement && level <= 3) {
    const computedStyle = window.getComputedStyle(currentElement);
    
    // If parent has problematic display values, fix them
    if (computedStyle.display === 'none' || 
        computedStyle.visibility === 'hidden' || 
        computedStyle.opacity === '0' ||
        parseFloat(computedStyle.width) === 0 ||
        parseFloat(computedStyle.height) === 0) {
      
      currentElement.style.display = 'block';
      currentElement.style.visibility = 'visible';
      currentElement.style.opacity = '1';
      currentElement.style.minWidth = 'auto';
      currentElement.style.minHeight = 'auto';
      currentElement.style.width = 'auto';
      currentElement.style.height = 'auto';
      currentElement.style.overflow = 'visible';
      
      // If it's a grid container, make sure it doesn't collapse
      if (computedStyle.display.includes('grid')) {
        currentElement.style.gridTemplateColumns = 'none';
        currentElement.style.gridTemplate = 'none';
        currentElement.style.display = 'block';
      }
    }
    
    currentElement = currentElement.parentElement;
    level++;
  }
}
