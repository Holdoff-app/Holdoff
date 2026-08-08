package com.holdoff.app.data.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Play Console product IDs. These must exist and be active before a build ships. */
object Products {
    const val MONTHLY = "holdoff_premium_monthly"
    const val YEARLY = "holdoff_premium_yearly"
    const val LIFETIME = "holdoff_premium_lifetime"

    val SUBSCRIPTIONS = listOf(MONTHLY, YEARLY)
    val ONE_TIME = listOf(LIFETIME)
}

/** A plan the user can actually buy, with the price Play reports for their region. */
data class Plan(
    val productId: String,
    val label: String,
    val formattedPrice: String,
    val badge: String?,
    val details: ProductDetails,
    val offerToken: String?
)

data class BillingUiState(
    val plans: List<Plan> = emptyList(),
    val isLoading: Boolean = true,
    val isPremium: Boolean = false,
    val error: String? = null
)

/**
 * Owns the Play Billing connection. Entitlement comes from Play's own purchase
 * record, never from a local flag the UI can flip.
 */
class BillingManager(
    context: Context,
    private val onPremiumChanged: (Boolean) -> Unit
) : PurchasesUpdatedListener {

    private val _state = MutableStateFlow(BillingUiState())
    val state: StateFlow<BillingUiState> = _state

    private val client = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    fun start() {
        if (client.isReady) return
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    refresh()
                } else {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = result.debugMessage.ifBlank { "Google Play billing is unavailable." }
                    )
                }
            }

            override fun onBillingServiceDisconnected() {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = "Lost the connection to Google Play."
                )
            }
        })
    }

    fun dispose() = client.endConnection()

    private fun refresh() {
        queryPlans()
        queryEntitlement()
    }

    private fun queryPlans() {
        val subParams = QueryProductDetailsParams.newBuilder()
            .setProductList(
                Products.SUBSCRIPTIONS.map {
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(it)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                }
            ).build()

        val inAppParams = QueryProductDetailsParams.newBuilder()
            .setProductList(
                Products.ONE_TIME.map {
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(it)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                }
            ).build()

        val collected = mutableListOf<Plan>()
        var pending = 2

        fun done(result: BillingResult, details: List<ProductDetails>) {
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                collected += details.mapNotNull(::toPlan)
            }
            if (--pending == 0) {
                val ordered = collected.sortedBy { plan ->
                    when (plan.productId) {
                        Products.MONTHLY -> 0
                        Products.YEARLY -> 1
                        else -> 2
                    }
                }
                _state.value = _state.value.copy(
                    plans = ordered,
                    isLoading = false,
                    error = if (ordered.isEmpty()) "No plans are available right now." else null
                )
            }
        }

        client.queryProductDetailsAsync(subParams) { r, d -> done(r, d) }
        client.queryProductDetailsAsync(inAppParams) { r, d -> done(r, d) }
    }

    private fun toPlan(details: ProductDetails): Plan? = when (details.productId) {
        Products.MONTHLY, Products.YEARLY -> {
            val offer = details.subscriptionOfferDetails?.firstOrNull()
            val phase = offer?.pricingPhases?.pricingPhaseList?.lastOrNull()
            if (offer == null || phase == null) null
            else Plan(
                productId = details.productId,
                label = if (details.productId == Products.MONTHLY) "Monthly" else "Yearly",
                formattedPrice = phase.formattedPrice,
                badge = if (details.productId == Products.YEARLY) "Best value" else null,
                details = details,
                offerToken = offer.offerToken
            )
        }
        Products.LIFETIME -> details.oneTimePurchaseOfferDetails?.let {
            Plan(
                productId = details.productId,
                label = "Lifetime access",
                formattedPrice = it.formattedPrice,
                badge = "One-time",
                details = details,
                offerToken = null
            )
        }
        else -> null
    }

    fun launchPurchase(activity: Activity, plan: Plan) {
        val product = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(plan.details)
            .apply { plan.offerToken?.let { setOfferToken(it) } }
            .build()

        val result = client.launchBillingFlow(
            activity,
            BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(product)).build()
        )

        if (result.responseCode != BillingClient.BillingResponseCode.OK) {
            _state.value = _state.value.copy(
                error = result.debugMessage.ifBlank { "Couldn't open Google Play checkout." }
            )
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK ->
                purchases?.forEach { grantIfPurchased(it) }
            BillingClient.BillingResponseCode.USER_CANCELED -> Unit
            else -> _state.value = _state.value.copy(
                error = result.debugMessage.ifBlank { "That purchase didn't go through." }
            )
        }
    }

    private fun queryEntitlement() {
        var pending = 2
        var entitled = false

        fun done(purchases: List<Purchase>) {
            if (purchases.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }) entitled = true
            purchases.forEach { grantIfPurchased(it) }
            if (--pending == 0) setPremium(entitled)
        }

        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { _, p -> done(p) }
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        ) { _, p -> done(p) }
    }

    private fun grantIfPurchased(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        setPremium(true)
        // Play refunds anything left unacknowledged for three days.
        if (!purchase.isAcknowledged) {
            client.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.purchaseToken)
                    .build()
            ) { }
        }
    }

    /** Also called with false so a lapsed subscription clears the saved flag. */
    private fun setPremium(value: Boolean) {
        _state.value = _state.value.copy(isPremium = value)
        onPremiumChanged(value)
    }
}
