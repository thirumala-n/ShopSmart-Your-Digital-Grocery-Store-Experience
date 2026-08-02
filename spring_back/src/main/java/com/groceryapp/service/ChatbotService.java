package com.groceryapp.service;

import com.groceryapp.config.AppProperties;
import com.groceryapp.dto.ChatbotRequest;
import com.groceryapp.dto.ChatbotResponse;
import com.groceryapp.exception.AppException;
import com.groceryapp.model.Category;
import com.groceryapp.model.Product;
import com.groceryapp.security.AuthContext;
import com.groceryapp.security.AuthUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatbotService {
    private static final Logger log = LoggerFactory.getLogger(ChatbotService.class);
    private static final Pattern PRICE_LIMIT = Pattern.compile("(?:under|below|less than|upto|up to)\\s*(?:rs\\.?|inr|₹)?\\s*(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUANTITY = Pattern.compile("\\b(\\d+)\\b");

    private final AppProperties appProperties;
    private final RestClient.Builder restClientBuilder;
    private final CatalogService catalogService;
    private final CartService cartService;
    private final WishlistService wishlistService;
    private final OrderService orderService;
    private final OfferService offerService;

    @Autowired
    public ChatbotService(
            AppProperties appProperties,
            RestClient.Builder restClientBuilder,
            CatalogService catalogService,
            CartService cartService,
            WishlistService wishlistService,
            OrderService orderService,
            OfferService offerService
    ) {
        this.appProperties = appProperties;
        this.restClientBuilder = restClientBuilder;
        this.catalogService = catalogService;
        this.cartService = cartService;
        this.wishlistService = wishlistService;
        this.orderService = orderService;
        this.offerService = offerService;
    }

    public ChatbotService(AppProperties appProperties, RestClient.Builder restClientBuilder) {
        this(appProperties, restClientBuilder, null, null, null, null, null);
    }

    public ChatbotResponse answer(ChatbotRequest request) {
        String message = request.getMessage().trim();
        String lower = message.toLowerCase(Locale.ROOT);

        if (catalogService != null) {
            ChatbotResponse deterministic = answerFromStoreData(message, lower);
            if (deterministic != null) {
                return deterministic;
            }
        }

        if (!isShoppingRelated(lower)) {
            return response("scope", "fallback",
                    "I'm designed to help you with shopping, products, orders, and our store.", null);
        }

        String aiReply = askConfiguredAi(message, request.getHistory());
        if (!aiReply.isBlank()) {
            return response("shopping_help", "ai", aiReply, null);
        }
        return response("shopping_help", "fallback", ruleBasedAnswer(message), null);
    }

    public String answer(String message) {
        return ruleBasedAnswer(message);
    }

    private ChatbotResponse answerFromStoreData(String message, String lower) {
        if (containsAny(lower, "cart", "basket")) {
            return answerCart(message, lower);
        }
        if (containsAny(lower, "wishlist", "wish list")) {
            return answerWishlist(message, lower);
        }
        if (containsAny(lower, "order", "track")) {
            return answerOrders(lower);
        }
        if (containsAny(lower, "payment", "upi", "cod", "cash on delivery", "card")) {
            return answerPayment();
        }
        if (containsAny(lower, "delivery", "shipping", "delivery charge", "shipping time")) {
            return answerDelivery();
        }
        if (containsAny(lower, "return", "refund", "replacement")) {
            return answerReturnRefund();
        }
        if (containsAny(lower, "recommend", "suggest", "popular", "best")) {
            return answerProductSearch(message, "recommendations");
        }
        if (containsAny(lower, "show", "search", "find", "product", "products", "phone", "phones", "laptop", "mouse", "headphone", "grocery", "groceries", "electronics", "fashion", "mobile", "mobiles")) {
            return answerProductSearch(message, "product_search");
        }
        if (containsAny(lower, "tell me about", "in stock", "specification", "specifications", "warranty")) {
            return answerProductDetails(message);
        }
        return null;
    }

    private ChatbotResponse answerProductSearch(String message, String intent) {
        Map<String, String> params = productSearchParams(message, intent);
        Map<String, Object> data = catalogService.listProducts(params);
        List<Map<String, Object>> products = summarizeProducts(list(data.get("items")));

        Map<String, Object> payload = new HashMap<>();
        payload.put("products", products);
        payload.put("total", data.getOrDefault("total", products.size()));
        payload.put("query", params);

        String reply = products.isEmpty()
                ? "I couldn't find matching products in the catalog. Try a different product name, brand, category, or price."
                : "Here are real products from the catalog that match your request.";
        return response(intent, "catalog", reply, payload);
    }

    private ChatbotResponse answerProductDetails(String message) {
        Optional<Map<String, Object>> match = findBestProduct(cleanProductQuery(message));
        if (match.isEmpty()) {
            return answerProductSearch(message, "product_details");
        }
        Map<String, Object> product = summarizeProduct(match.get());
        String reply = product.get("name") + " is " + product.get("stockStatus") + ". "
                + "Price starts at ₹" + product.get("price") + ". "
                + (isBlank(str(product.get("shortDescription"))) ? "No detailed description is available." : product.get("shortDescription"));
        if (message.toLowerCase(Locale.ROOT).contains("warranty")) {
            reply += " Warranty details are not stored in the current product catalog.";
        }
        return response("product_details", "catalog", reply, Map.of("products", List.of(product)));
    }

    private ChatbotResponse answerCart(String message, String lower) {
        AuthUser auth = currentUserOrNull();
        if (auth == null) {
            return authRequired("cart");
        }
        if (containsAny(lower, "add")) {
            Optional<Map<String, Object>> product = findBestProduct(cleanProductQuery(message));
            if (product.isEmpty()) {
                return answerProductSearch(message, "cart_add_options");
            }
            Map<String, Object> summary = summarizeProduct(product.get());
            Product.Variant variant = firstAvailableVariant(product.get("variants"));
            if (variant == null) {
                return response("cart_add", "cart", summary.get("name") + " is currently out of stock.", Map.of("products", List.of(summary)));
            }
            Map<String, Object> cart = cartService.addItem(auth.getUserId(), str(summary.get("_id")), variant.getVariantId(), quantityFrom(message));
            return response("cart_add", "cart", "Added " + summary.get("name") + " to your cart.", Map.of("cart", cart, "products", List.of(summary)));
        }
        if (containsAny(lower, "remove", "delete")) {
            Map<String, Object> cart = cartService.getCart(auth.getUserId());
            Map<String, Object> line = findCartLine(cart, cleanProductQuery(message));
            if (line == null) {
                return response("cart_remove", "cart", "I couldn't find that product in your cart.", Map.of("cart", cart));
            }
            cart = cartService.removeItem(auth.getUserId(), str(line.get("productId")), str(line.get("variantId")));
            return response("cart_remove", "cart", "Removed " + line.get("productName") + " from your cart.", Map.of("cart", cart));
        }
        Map<String, Object> cart = cartService.getCart(auth.getUserId());
        Map<String, Object> summary = map(cart.get("summary"));
        List<Object> lines = list(cart.get("lines"));
        String reply = lines.isEmpty()
                ? "Your cart is empty."
                : "Your cart has " + lines.size() + " item(s). Grand total: ₹" + summary.getOrDefault("grandTotal", 0) + ".";
        return response("cart_view", "cart", reply, Map.of("cart", cart));
    }

    private ChatbotResponse answerWishlist(String message, String lower) {
        AuthUser auth = currentUserOrNull();
        if (auth == null) {
            return authRequired("wishlist");
        }
        if (containsAny(lower, "add")) {
            Optional<Map<String, Object>> product = findBestProduct(cleanProductQuery(message));
            if (product.isEmpty()) {
                return answerProductSearch(message, "wishlist_add_options");
            }
            Map<String, Object> summary = summarizeProduct(product.get());
            List<Object> wishlist = wishlistService.addWishlistItem(auth.getUserId(), str(summary.get("_id")));
            return response("wishlist_add", "wishlist", "Added " + summary.get("name") + " to your wishlist.", Map.of("wishlistItems", wishlist, "products", List.of(summary)));
        }
        if (containsAny(lower, "remove", "delete")) {
            Optional<Map<String, Object>> product = findBestProduct(cleanProductQuery(message));
            if (product.isEmpty()) {
                return response("wishlist_remove", "wishlist", "Tell me which product to remove from your wishlist.", null);
            }
            Map<String, Object> summary = summarizeProduct(product.get());
            List<Object> wishlist = wishlistService.removeWishlistItem(auth.getUserId(), str(summary.get("_id")));
            return response("wishlist_remove", "wishlist", "Removed " + summary.get("name") + " from your wishlist.", Map.of("wishlistItems", wishlist));
        }
        List<Object> wishlist = wishlistService.listWishlist(auth.getUserId());
        String reply = wishlist.isEmpty() ? "Your wishlist is empty." : "Your wishlist has " + wishlist.size() + " product(s).";
        return response("wishlist_view", "wishlist", reply, Map.of("wishlistItems", wishlist));
    }

    private ChatbotResponse answerOrders(String lower) {
        AuthUser auth = currentUserOrNull();
        if (auth == null) {
            return authRequired("orders");
        }
        boolean history = containsAny(lower, "history", "old", "past");
        Map<String, Object> orders = orderService.listUserOrders(auth.getUserId(), !history, 1, containsAny(lower, "latest", "last") ? 1 : 5);
        List<Object> items = list(orders.get("items"));
        String reply = items.isEmpty()
                ? "I couldn't find matching orders for your account."
                : "I found " + items.size() + " order(s). You can open Orders for full tracking details.";
        return response(history ? "order_history" : "order_status", "orders", reply, Map.of("orders", orders));
    }

    private ChatbotResponse answerPayment() {
        String provider = isBlank(appProperties.getPaymentProvider()) ? "configured checkout payment provider" : appProperties.getPaymentProvider();
        String reply = "You can pay during checkout using " + provider + ". Cash on Delivery is supported when the order flow allows COD; online payment confirmation is handled through the payment endpoints.";
        return response("payment_help", "config", reply, Map.of("paymentProvider", provider));
    }

    private ChatbotResponse answerDelivery() {
        Map<String, Object> help = offerService == null ? Map.of() : offerService.getHelpContent();
        Object policy = help.get("deliveryInfo");
        String reply = "Delivery charges are calculated at checkout. Current default delivery fee is ₹" + appProperties.getDefaultDeliveryFee()
                + ", with free delivery above ₹" + appProperties.getFreeDeliveryThreshold() + ".";
        if (policy != null) {
            reply += " I also found delivery policy content in the store help data.";
        }
        return response("delivery_help", "policy", reply, Map.of("policy", policy == null ? "" : policy));
    }

    private ChatbotResponse answerReturnRefund() {
        Map<String, Object> help = offerService == null ? Map.of() : offerService.getHelpContent();
        Object policy = help.get("returnPolicy");
        String reply = policy == null
                ? "Returns, refunds, and replacements are handled from the Orders flow after an eligible order is placed."
                : "I found the store return and refund policy. Please review it from the help/offer content for exact eligibility.";
        return response("return_refund_help", "policy", reply, Map.of("policy", policy == null ? "" : policy));
    }

    private Map<String, String> productSearchParams(String message, String intent) {
        String query = cleanProductQuery(message);
        Map<String, String> params = new HashMap<>();
        params.put("page", "1");
        params.put("pageSize", "5");
        params.put("sortBy", "recommendations".equals(intent) ? "popularity" : "relevance");
        Integer maxPrice = maxPrice(message);
        if (maxPrice != null) {
            params.put("maxPrice", String.valueOf(maxPrice));
        }

        Optional<Category> category = findCategory(query);
        if (category.isPresent()) {
            Category c = category.get();
            params.put((c.getLevel() != null && c.getLevel() > 0) ? "subCategoryId" : "categoryId", c.getId());
            query = query.replace(c.getName().toLowerCase(Locale.ROOT), "").replace(str(c.getSlug()).toLowerCase(Locale.ROOT), "").trim();
        }
        if (!query.isBlank()) {
            params.put("search", query);
        }
        return params;
    }

    private Optional<Category> findCategory(String query) {
        String lower = query.toLowerCase(Locale.ROOT);
        List<Category> categories = new ArrayList<>(catalogService.listRootCategories());
        for (Category root : new ArrayList<>(categories)) {
            categories.addAll(catalogService.listSubCategories(root.getId()));
        }
        return categories.stream()
                .filter(c -> lower.contains(str(c.getName()).toLowerCase(Locale.ROOT)) || lower.contains(str(c.getSlug()).toLowerCase(Locale.ROOT)))
                .findFirst();
    }

    private Optional<Map<String, Object>> findBestProduct(String query) {
        String cleaned = query.isBlank() ? "" : query;
        Map<String, Object> data = catalogService.listProducts(Map.of("page", "1", "pageSize", "5", "search", cleaned));
        List<Object> products = list(data.get("items"));
        if (products.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> first = map(products.get(0));
        return catalogService.getProductById(str(first.get("_id"))).or(() -> Optional.of(first));
    }

    private List<Map<String, Object>> summarizeProducts(List<Object> products) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : products) {
            Map<String, Object> product = map(item);
            catalogService.getProductById(str(product.get("_id"))).ifPresentOrElse(
                    details -> out.add(summarizeProduct(details)),
                    () -> out.add(summarizeProduct(product))
            );
        }
        return out;
    }

    private Map<String, Object> summarizeProduct(Map<String, Object> p) {
        List<Object> variants = list(p.get("variants"));
        double minPrice = variants.stream().map(this::map).map(v -> n(v.get("price"))).filter(v -> v > 0).min(Double::compareTo).orElse(0d);
        int stock = variants.stream().map(this::map).mapToInt(v -> ((Number) v.getOrDefault("stock", 0)).intValue()).sum();
        Map<String, Object> out = new HashMap<>();
        out.put("_id", p.get("_id"));
        out.put("name", p.get("name"));
        out.put("slug", p.get("slug"));
        out.put("brand", p.get("brand"));
        out.put("price", minPrice);
        out.put("rating", p.getOrDefault("rating", 0));
        out.put("stockStatus", stock > 0 ? "in stock" : "out of stock");
        out.put("shortDescription", shortText(str(p.get("description"))));
        out.put("image", firstImage(p.get("images")));
        out.put("variants", variants);
        return out;
    }

    private Product.Variant firstAvailableVariant(Object variantsValue) {
        for (Object item : list(variantsValue)) {
            if (item instanceof Product.Variant variant && variant.getStock() != null && variant.getStock() > 0) {
                return variant;
            }
        }
        return null;
    }

    private Map<String, Object> findCartLine(Map<String, Object> cart, String productQuery) {
        String lower = productQuery.toLowerCase(Locale.ROOT);
        for (Object item : list(cart.get("lines"))) {
            Map<String, Object> line = map(item);
            if (str(line.get("productName")).toLowerCase(Locale.ROOT).contains(lower) || lower.contains(str(line.get("productName")).toLowerCase(Locale.ROOT))) {
                return line;
            }
        }
        return null;
    }

    private String cleanProductQuery(String message) {
        String cleaned = message.toLowerCase(Locale.ROOT)
                .replaceAll("tell me about|is this product in stock|is .* in stock|what is the warranty|show product specifications|show specifications", " ")
                .replaceAll("show|search for|search|find|products|product|recommend|suggest|popular|best|add|remove|delete|to cart|from cart|to wishlist|from wishlist|wishlist|cart|under|below|less than|upto|up to|rs\\.?|inr|₹|\\d+", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (cleaned.isBlank()) {
            cleaned = message.replaceAll("\\s+", " ").trim();
        }
        return cleaned;
    }

    private Integer maxPrice(String message) {
        Matcher matcher = PRICE_LIMIT.matcher(message);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private int quantityFrom(String message) {
        Matcher matcher = QUANTITY.matcher(message);
        if (matcher.find()) {
            try {
                return Math.max(1, Math.min(20, Integer.parseInt(matcher.group(1))));
            } catch (NumberFormatException ignored) {
                return 1;
            }
        }
        return 1;
    }

    private AuthUser currentUserOrNull() {
        try {
            return AuthContext.current();
        } catch (AppException ex) {
            return null;
        }
    }

    private ChatbotResponse authRequired(String intent) {
        return response(intent, "auth", "Please log in to use " + intent + " features. You can still browse products without signing in.", null);
    }

    private ChatbotResponse response(String intent, String source, String reply, Object data) {
        return ChatbotResponse.builder()
                .success(true)
                .intent(intent)
                .source(source)
                .reply(reply)
                .data(data)
                .build();
    }

    private String askConfiguredAi(String message, List<ChatbotRequest.ChatMessage> history) {
        AppProperties.Ai ai = appProperties.getAi();
        if (ai == null || !ai.isEnabled() || isBlank(ai.getApiKey())) {
            return "";
        }
        if (!"OPENAI".equalsIgnoreCase(ai.getProvider())) {
            log.warn("Unsupported AI chatbot provider configured: {}", ai.getProvider());
            return "";
        }

        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(ai.getTimeout());
            requestFactory.setReadTimeout(ai.getTimeout());

            RestClient client = restClientBuilder
                    .baseUrl(ai.getBaseUrl())
                    .defaultHeader("Authorization", "Bearer " + ai.getApiKey())
                    .requestFactory(requestFactory)
                    .build();

            Map<String, Object> response = client.post()
                    .uri("/chat/completions")
                    .body(Map.of(
                            "model", isBlank(ai.getModel()) ? "gpt-4o-mini" : ai.getModel(),
                            "temperature", 0.2,
                            "messages", buildMessages(message, history)
                    ))
                    .retrieve()
                    .body(Map.class);

            return extractReply(response);
        } catch (RuntimeException ex) {
            log.warn("AI chatbot provider failed; using fallback response: {}", ex.getMessage());
            return "";
        }
    }

    private List<Map<String, String>> buildMessages(String message, List<ChatbotRequest.ChatMessage> history) {
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of(
                "role", "system",
                "content", "You are GrocerEase's e-commerce shopping assistant. Help only with products, cart, orders, delivery, payments, returns, and account questions. Do not answer unrelated general knowledge questions."
        ));

        if (history != null) {
            history.stream()
                    .filter(item -> item != null && !isBlank(item.getContent()))
                    .limit(10)
                    .forEach(item -> messages.add(Map.of(
                            "role", "user".equalsIgnoreCase(item.getRole()) ? "user" : "assistant",
                            "content", item.getContent().trim()
                    )));
        }

        messages.add(Map.of("role", "user", "content", message));
        return messages;
    }

    private String extractReply(Map<String, Object> response) {
        if (response == null) {
            return "";
        }
        Object choicesObj = response.get("choices");
        if (!(choicesObj instanceof List<?> choices) || choices.isEmpty()) {
            return "";
        }
        Object firstObj = choices.get(0);
        if (!(firstObj instanceof Map<?, ?> first)) {
            return "";
        }
        Object messageObj = first.get("message");
        if (!(messageObj instanceof Map<?, ?> messageMap)) {
            return "";
        }
        Object content = messageMap.get("content");
        return content == null ? "" : String.valueOf(content).trim();
    }

    private String ruleBasedAnswer(String message) {
        String normalized = message == null ? "" : message.trim();
        if (normalized.isBlank()) {
            return "Hello! I can help with products, orders, delivery, and account questions.";
        }

        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.contains("order")) {
            return "You can view your orders from the Orders page or ask me about a specific order status.";
        }
        if (lower.contains("product")) {
            return "You can browse products from the Products page and filter by category or search.";
        }
        if (lower.contains("delivery")) {
            return "Delivery availability and slots are handled by the public delivery endpoints in the backend.";
        }
        if (lower.contains("payment")) {
            return "Payments can be confirmed after checkout through the orders flow.";
        }
        if (lower.contains("cart")) {
            return "You can add products to your cart, apply coupons, and checkout when you are signed in.";
        }
        if (lower.contains("return") || lower.contains("refund")) {
            return "Refunds and cancellations are handled from the Orders page after an eligible order is placed.";
        }
        return "I can help with products, orders, delivery, payments, and account support.";
    }

    private boolean isShoppingRelated(String value) {
        return containsAny(value, "shop", "store", "product", "order", "cart", "wishlist", "delivery", "payment", "refund", "return", "account", "price", "stock", "category");
    }

    private boolean containsAny(String value, String... needles) {
        for (String needle : needles) {
            if (value.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private String firstImage(Object images) {
        List<Object> list = list(images);
        return list.isEmpty() ? "" : str(list.get(0));
    }

    private String shortText(String value) {
        if (value.length() <= 140) {
            return value;
        }
        return value.substring(0, 137) + "...";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isBlank();
    }

    private String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private double n(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(str(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return new HashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Object> list(Object value) {
        if (value instanceof List<?> list) {
            return (List<Object>) list;
        }
        return List.of();
    }
}
