// ===== Utilities =====

function debounce(fn, delay) {
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
}

function throttleRAF(fn) {
	let rafId = null;
	return (...args) => {
		if (rafId) {
			return;
		}
		rafId = requestAnimationFrame(() => {
			fn(...args);
			rafId = null;
		});
	};
}

// ===== State =====

const catalogueState = {
	filter: "all",
	sort: "featured",
	minPrice: 60,
	maxPrice: 100
};

// Cached once on first call — avoids repeated querySelectorAll on every filter/sort
let _productCards = null;

function getProductCards() {
	if (!_productCards) {
		const grid = document.getElementById("productGrid");
		_productCards = grid ? Array.from(grid.querySelectorAll(".product-card")) : [];
	}

	return _productCards;
}

function updateCatalogueCount(visibleCount, totalCount) {
	const countEl = document.getElementById("catalogueCount");
	if (!countEl) {
		return;
	}

	if (visibleCount === totalCount) {
		countEl.textContent = `Showing all ${totalCount} fragrances.`;
		return;
	}

	if (visibleCount === 0) {
		countEl.textContent = "No fragrances match your search right now.";
		return;
	}

	countEl.textContent = `Showing ${visibleCount} of ${totalCount} fragrances.`;
}

function updateNoResultsCard(visibleCount, query) {
	const card = document.getElementById("noResultsCard");
	const cta = document.getElementById("noResultsCta");
	if (!card || !cta) {
		return;
	}

	const isHidden = visibleCount > 0;
	card.hidden = isHidden;

	if (isHidden) {
		return;
	}

	const parts = [];
	if (query) {
		parts.push(`search \"${query}\"`);
	}
	if (catalogueState.filter !== "all") {
		parts.push(`family ${catalogueState.filter}`);
	}
	parts.push(`budget from $${catalogueState.minPrice} to $${catalogueState.maxPrice}`);

	const prompt = encodeURIComponent(`Hello, please recommend a fragrance for ${parts.join(", ")}.`);
	cta.href = `https://wa.me/254700000000?text=${prompt}`;
}

function sortCards(cards) {
	const sorted = [...cards];

	sorted.sort((a, b) => {
		if (catalogueState.sort === "price-asc") {
			return Number(a.dataset.price) - Number(b.dataset.price);
		}

		if (catalogueState.sort === "price-desc") {
			return Number(b.dataset.price) - Number(a.dataset.price);
		}

		if (catalogueState.sort === "name-asc") {
			return (a.dataset.name || "").localeCompare(b.dataset.name || "");
		}

		return Number(a.dataset.order) - Number(b.dataset.order);
	});

	return sorted;
}

function applyCatalogueState() {
	const grid = document.getElementById("productGrid");
	if (!grid) {
		return;
	}

	const input = document.getElementById("searchInput");
	const query = input ? input.value.trim().toLowerCase() : "";
	const allCards = getProductCards();
	const sortedCards = sortCards(allCards);

	// Batch sort reorder + visibility in one DocumentFragment (single reflow)
	const fragment = document.createDocumentFragment();
	let visibleCount = 0;

	sortedCards.forEach((card) => {
		const name = card.dataset.name || "";
		const category = card.dataset.category || "";
		const price = Number(card.dataset.price || 0);
		const notesText = card.querySelector(".notes")?.textContent?.toLowerCase() || "";

		const isVisible =
			(query === "" || name.includes(query) || notesText.includes(query)) &&
			(catalogueState.filter === "all" || category === catalogueState.filter) &&
			price >= catalogueState.minPrice &&
			price <= catalogueState.maxPrice;

		// Use class toggle — preserves the card's flex display, avoids layout bugs
		card.classList.toggle("card-hidden", !isVisible);
		if (isVisible) {
			visibleCount++;
		}

		fragment.appendChild(card);
	});

	grid.appendChild(fragment);
	updateCatalogueCount(visibleCount, sortedCards.length);
	updateNoResultsCard(visibleCount, query);
}

function searchProducts() {
	applyCatalogueState();
}

function scrollToCatalogue() {
	document.getElementById("catalogue")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupSearchInput() {
	const input = document.getElementById("searchInput");
	if (!input) {
		return;
	}

	const debouncedApply = debounce(applyCatalogueState, 250);

	input.addEventListener("input", debouncedApply);
	input.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			applyCatalogueState(); // Immediate on Enter
		}
	});
}

function setupCatalogueControls() {
	const chips = Array.from(document.querySelectorAll(".filter-chip"));
	const sortSelect = document.getElementById("sortSelect");
	const minPriceRange = document.getElementById("minPriceRange");
	const maxPriceRange = document.getElementById("maxPriceRange");
	const minPriceValue = document.getElementById("minPriceValue");
	const maxPriceValue = document.getElementById("maxPriceValue");

	chips.forEach((chip) => {
		chip.addEventListener("click", () => {
			catalogueState.filter = chip.dataset.filter || "all";

			chips.forEach((item) => item.classList.remove("is-active"));
			chip.classList.add("is-active");

			applyCatalogueState();
		});
	});

	if (sortSelect) {
		sortSelect.addEventListener("change", () => {
			catalogueState.sort = sortSelect.value;
			applyCatalogueState();
		});
	}

	if (minPriceRange && maxPriceRange && minPriceValue && maxPriceValue) {
		catalogueState.minPrice = Number(minPriceRange.value);
		catalogueState.maxPrice = Number(maxPriceRange.value);

		function renderPrices() {
			minPriceValue.textContent = `$${catalogueState.minPrice}`;
			maxPriceValue.textContent = `$${catalogueState.maxPrice}`;
		}

		const debouncedApply = debounce(applyCatalogueState, 150);

		minPriceRange.addEventListener("input", () => {
			const v = Number(minPriceRange.value);
			catalogueState.minPrice = v > catalogueState.maxPrice - 2 ? catalogueState.maxPrice - 2 : v;
			minPriceRange.value = String(catalogueState.minPrice);
			renderPrices();
			debouncedApply();
		});

		maxPriceRange.addEventListener("input", () => {
			const v = Number(maxPriceRange.value);
			catalogueState.maxPrice = v < catalogueState.minPrice + 2 ? catalogueState.minPrice + 2 : v;
			maxPriceRange.value = String(catalogueState.maxPrice);
			renderPrices();
			debouncedApply();
		});

		renderPrices();
	}

	applyCatalogueState();
}

function setupQuickViewModal() {
	const modal = document.getElementById("quickViewModal");
	const grid = document.getElementById("productGrid");
	if (!modal || !grid) {
		return;
	}

	modal.hidden = true;
	modal.setAttribute("aria-hidden", "true");

	const image = document.getElementById("quickViewImage");
	const title = document.getElementById("quickViewTitle");
	const price = document.getElementById("quickViewPrice");
	const notes = document.getElementById("quickViewNotes");
	const wear = document.getElementById("quickViewWear");
	const whatsapp = document.getElementById("quickViewWhatsapp");
	const closeButton = modal.querySelector(".quick-view-close");
	const fallbackImage = "images/hero.jpeg";
	let lastTrigger = null;

	function getCardData(card) {
		const cardImage = card.querySelector("img");
		const cardTitle = card.querySelector(".product-info h3")?.textContent?.trim() || "Fragrance";
		const cardPrice = card.querySelector(".price")?.textContent?.trim() || "";
		const cardNotes = card.querySelector(".notes")?.textContent?.trim() || "";
		const cardWear = card.querySelector(".wear")?.textContent?.trim() || "";
		const cardImageSrc = cardImage?.currentSrc || cardImage?.getAttribute("src") || fallbackImage;

		return {
			title: cardTitle,
			price: cardPrice,
			notes: cardNotes,
			wear: cardWear,
			imageSrc: cardImageSrc,
			imageAlt: cardImage?.alt || `${cardTitle} perfume`
		};
	}

	function openModal(product) {
		if (image) {
			image.src = product.imageSrc || fallbackImage;
			image.alt = product.imageAlt;
			image.onerror = () => {
				image.src = fallbackImage;
			};
		}

		if (title) {
			title.textContent = product.title;
		}
		if (price) {
			price.textContent = product.price;
		}
		if (notes) {
			notes.textContent = product.notes;
		}
		if (wear) {
			wear.textContent = product.wear;
		}

		if (whatsapp) {
			const prefill = encodeURIComponent(`Hello I want to order ${product.title}`);
			whatsapp.href = `https://wa.me/254700000000?text=${prefill}`;
		}

		modal.hidden = false;
		modal.setAttribute("aria-hidden", "false");
		document.body.style.overflow = "hidden";
		closeButton?.focus();
	}

	function closeModal() {
		modal.hidden = true;
		modal.setAttribute("aria-hidden", "true");
		document.body.style.overflow = "";
		lastTrigger?.focus();
	}

	grid.addEventListener("click", (event) => {
		const trigger = event.target.closest("[data-quickview]");
		if (!trigger) {
			return;
		}

		event.preventDefault();

		const card = trigger.closest(".product-card");
		if (!card) {
			return;
		}

		lastTrigger = trigger;
		openModal(getCardData(card));
	});

	modal.addEventListener("click", (event) => {
		if (event.target.closest("[data-close-modal]")) {
			closeModal();
		}
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape" && !modal.hidden) {
			closeModal();
		}
	});
}

function setupImageLoadingEffects() {
	const fallbackImage = "images/hero.jpeg";
	const targets = document.querySelectorAll(".logo, .hero-image img, .featured-card img, .product-card img");

	targets.forEach((img) => {
		const shell = img.parentElement;
		if (!shell) {
			return;
		}

		shell.classList.add("image-loading");

		function markLoaded() {
			shell.classList.add("image-loaded");
		}

		if (img.complete) {
			if (img.naturalWidth === 0 && !img.src.endsWith(fallbackImage)) {
				img.src = fallbackImage;
				return;
			}

			markLoaded();
			return;
		}

		img.addEventListener("load", markLoaded, { once: true });
		img.addEventListener(
			"error",
			() => {
				if (!img.src.endsWith(fallbackImage)) {
					img.src = fallbackImage;
					return;
				}

				markLoaded();
			},
			{ once: true }
		);
	});
}

function setupThemeToggle() {
	const toggle = document.getElementById("themeToggle");
	if (!toggle) {
		return;
	}

	const body = document.body;
	const storageKey = "classyscents-theme";

	function renderToggle() {
		const isDark = body.classList.contains("theme-dark");
		toggle.textContent = isDark ? "Day Mode" : "Night Mode";
		toggle.setAttribute("aria-label", isDark ? "Enable day mode" : "Enable dark mode");
	}

	const savedTheme = localStorage.getItem(storageKey);
	if (savedTheme === "dark") {
		body.classList.add("theme-dark");
	}

	renderToggle();

	toggle.addEventListener("click", () => {
		body.classList.toggle("theme-dark");
		const isDark = body.classList.contains("theme-dark");
		localStorage.setItem(storageKey, isDark ? "dark" : "light");
		renderToggle();
	});
}

function setupRevealAnimation() {
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		document.querySelectorAll(".section, .hero").forEach((el) => el.classList.add("is-visible"));
		return;
	}

	const revealTargets = document.querySelectorAll(".section, .hero");
	revealTargets.forEach((el) => el.classList.add("reveal"));

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add("is-visible");
					observer.unobserve(entry.target);
				}
			});
		},
		{
			threshold: 0.1,
			rootMargin: "0px 0px -30px 0px"
		}
	);

	revealTargets.forEach((el) => observer.observe(el));
}

function setupActiveNavState() {
	const navLinks = Array.from(document.querySelectorAll(".nav a"));
	const sections = navLinks
		.map((link) => document.querySelector(link.getAttribute("href")))
		.filter(Boolean);

	// Cache section offsets; reading offsetTop on every scroll forces layout
	let sectionOffsets = [];

	function cacheOffsets() {
		sectionOffsets = sections.map((s) => ({ id: s.id, top: s.offsetTop }));
	}

	cacheOffsets();
	window.addEventListener("resize", debounce(cacheOffsets, 200), { passive: true });

	const updateActiveLink = throttleRAF(() => {
		const offset = 140;
		let currentId = "";

		sectionOffsets.forEach(({ id, top }) => {
			if (window.scrollY >= top - offset) {
				currentId = id;
			}
		});

		navLinks.forEach((link) => {
			link.classList.toggle("is-active", link.getAttribute("href") === `#${currentId}`);
		});
	});

	window.addEventListener("scroll", updateActiveLink, { passive: true });
	updateActiveLink();
}

function setupNewsletterForm() {
	const form = document.querySelector(".newsletter-form");
	if (!form) {
		return;
	}

	const status = document.createElement("p");
	status.className = "newsletter-status";
	status.setAttribute("aria-live", "polite");
	form.appendChild(status);

	form.addEventListener("submit", (event) => {
		event.preventDefault();

		const email = form.querySelector("#email");
		const value = email?.value?.trim() || "";

		if (!value) {
			status.textContent = "Please add your email address.";
			return;
		}

		status.textContent = "Thanks for joining. We will send updates soon.";
		form.reset();
	});
};

document.addEventListener("DOMContentLoaded", () => {
	const preload = document.getElementById("preloadSplash");
	if (preload) {
		const hidePreload = () => {
			if (preload.classList.contains("hidden")) {
				return;
			}

			preload.classList.add("hidden");
			window.setTimeout(() => {
				preload.style.display = "none";
			}, 450);
		};

		if (document.readyState === "complete") {
			requestAnimationFrame(hidePreload);
		} else {
			window.addEventListener("load", hidePreload, { once: true });
			window.setTimeout(hidePreload, 1200);
		}
	}

	setupSearchInput();
	setupCatalogueControls();
	setupThemeToggle();
	setupQuickViewModal();
	setupImageLoadingEffects();
	setupRevealAnimation();
	setupActiveNavState();
	setupNewsletterForm();
});
