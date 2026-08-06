package live.shouldiholdoff.holdoff.billing

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * BillingManager wraps Google Play Billing for HoldOff Pro subscriptions.
 *
 * SKUs:
 *  - holdoff_pro_monthly  — monthly subscription
 *  - holdoff_pro_annual   — annual subscription
 *
 * Free tier: 3 analyses. Paywall fires on the 4th use, mirroring the web app.
 */
class BillingManager(private val context: Context) {

    companion object {
        private const val TAG = "HoldOff/Billing"
        const val SKU_MONTHLY = "holdoff_pro_monthly"
        const val SKU_ANNUAL  = "holdoff_pro_annual"
        const val FREE_VERDICT_LIMIT = 3
    }

    private val _isPro = MutableStateFlow(false)
    val isPro: StateFlow<Boolean> = _isPro

    private val _products = MutableStateFlow<List<ProductDetails>>(emptyList())
    val products: StateFlow<List<ProductDetails>> = _products

    private var billingClient: BillingClient? = null

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    fun connect() {
        billingClient = BillingClient.newBuilder(context)
            .setListener { billingResult, purchases ->
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
                    handlePurchases(purchases)
                }
            }
            .enablePendingPurchases()
            .build()

        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    Log.d(TAG, "Billing connected")
                    queryProducts()
                    queryExistingPurchases()
                }
            }

            override fun onBillingServiceDisconnected() {
                Log.w(TAG, "Billing disconnected — will reconnect on next call")
            }
        })
    }

    fun disconnect() {
        billingClient?.endConnection()
        billingClient = null
    }

    // ── Product query ─────────────────────────────────────────────────────────

    private fun queryProducts() {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(SKU_MONTHLY, SKU_ANNUAL).map { sku ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(sku)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                }
            )
            .build()

        billingClient?.queryProductDetailsAsync(params) { result, productDetailsList ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                _products.value = productDetailsList
                Log.d(TAG, "Loaded ${productDetailsList.size} products")
            }
        }
    }

    // ── Purchase flow ─────────────────────────────────────────────────────────

    fun launchPurchaseFlow(activity: Activity, product: ProductDetails) {
        val offerToken = product.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: return

        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(product)
                        .setOfferToken(offerToken)
                        .build()
                )
            )
            .build()

        billingClient?.launchBillingFlow(activity, params)
    }

    // ── Purchase verification ─────────────────────────────────────────────────

    fun queryExistingPurchases() {
        billingClient?.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        ) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                handlePurchases(purchases)
            }
        }
    }

    private fun handlePurchases(purchases: List<Purchase>) {
        val hasActiveSub = purchases.any { purchase ->
            purchase.purchaseState == Purchase.PurchaseState.PURCHASED &&
                (purchase.products.contains(SKU_MONTHLY) || purchase.products.contains(SKU_ANNUAL))
        }
        _isPro.value = hasActiveSub

        // Acknowledge unacknowledged purchases
        purchases.filter { !it.isAcknowledged && it.purchaseState == Purchase.PurchaseState.PURCHASED }
            .forEach { purchase ->
                val params = AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
                billingClient?.acknowledgePurchase(params) { result ->
                    Log.d(TAG, "Acknowledge result: ${result.responseCode} for ${purchase.orderId}")
                }
            }
    }

    fun refreshEntitlement() {
        queryExistingPurchases()
    }
}
