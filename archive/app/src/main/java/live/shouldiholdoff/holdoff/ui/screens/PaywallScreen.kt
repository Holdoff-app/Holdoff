package live.shouldiholdoff.holdoff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.android.billingclient.api.ProductDetails
import live.shouldiholdoff.holdoff.ui.theme.*

/**
 * PaywallScreen — shown after the 3rd free verdict.
 * Presents monthly + annual subscription options via Play Billing.
 * Free tier limit: 3 analyses (mirrors web app behaviour).
 */
@Composable
fun PaywallScreen(
    products: List<ProductDetails>,
    onSubscribe: (ProductDetails) -> Unit,
    onDismiss: () -> Unit
) {
    Surface(Modifier.fillMaxSize(), color = DeepSpace) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(40.dp))

            Text("💜", style = MaterialTheme.typography.displayMedium)
            Spacer(Modifier.height(16.dp))

            Text(
                "You've used your 3 free verdicts",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = StarGlow,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(8.dp))
            Text(
                "Upgrade to HoldOff Pro for unlimited insights, pattern tracking, and the full Sadie + Dan experience.",
                style = MaterialTheme.typography.bodyMedium,
                color = SoftLavender.copy(alpha = 0.8f),
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(32.dp))

            if (products.isEmpty()) {
                CircularProgressIndicator(color = MoonlitViolet)
            } else {
                products.forEach { product ->
                    val isAnnual = product.productId.contains("annual")
                    val label = if (isAnnual) "Annual — best value" else "Monthly"
                    val priceText = product.subscriptionOfferDetails
                        ?.firstOrNull()
                        ?.pricingPhases
                        ?.pricingPhaseList
                        ?.firstOrNull()
                        ?.formattedPrice
                        ?: (if (isAnnual) "$149/yr" else "$14.99/mo")

                    val highlight = isAnnual

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 6.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (highlight) MoonlitViolet.copy(alpha = 0.3f) else TwilightPurple
                        ),
                        border = if (highlight) CardDefaults.outlinedCardBorder() else null
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(label, fontWeight = FontWeight.SemiBold, color = StarGlow)
                                if (isAnnual) {
                                    Text(
                                        "Save ~16% vs monthly",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = SoftLavender.copy(alpha = 0.6f)
                                    )
                                }
                            }
                            Button(
                                onClick = { onSubscribe(product) },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text(priceText, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.weight(1f))

            TextButton(onClick = onDismiss) {
                Text(
                    "Maybe later",
                    color = SoftLavender.copy(alpha = 0.5f),
                    style = MaterialTheme.typography.bodySmall
                )
            }

            Text(
                "Subscriptions renew automatically. Cancel anytime in Play Store.",
                style = MaterialTheme.typography.bodySmall,
                color = SoftLavender.copy(alpha = 0.4f),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(bottom = 16.dp)
            )
        }
    }
}
