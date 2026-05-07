import React, { useState, useMemo } from "react";
import { ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { ModalScreen } from "../src/components/ModalScreen";
import { Card } from "../src/components/Card";
import { colors } from "../src/theme/colors";
import { computeTax, SEUILS, type Periode } from "../src/utils/taxCalc";
import { useData } from "../src/store/context";
import { computeMonthlyStats } from "../src/utils/monthly";

export default function FiscalScreen() {
  const { ventes } = useData();
  const [caInput, setCaInput] = useState("");
  const [periode, setPeriode] = useState<Periode>("mensuel");
  const [parts, setParts] = useState("1");

  // Auto-fill from real ventes data
  const monthly = useMemo(() => computeMonthlyStats(ventes), [ventes]);
  const currentMonthCA = monthly[0]?.revenue ?? 0;
  const annualCA = monthly.reduce((s, m) => s + m.revenue, 0);

  const caNum = caInput ? (Number(caInput) || 0) : (periode === "mensuel" ? currentMonthCA : annualCA);
  const caAnnuel = periode === "mensuel" ? caNum * 12 : caNum;

  const result = useMemo(() => computeTax(caAnnuel, Number(parts) || 1), [caAnnuel, parts]);

  const pctTVA = caAnnuel > 0 ? (caAnnuel / SEUILS.franchiseTVA) * 100 : 0;
  const pctPlafond = caAnnuel > 0 ? (caAnnuel / SEUILS.plafondCA) * 100 : 0;

  return (
    <ModalScreen title="Fiscal" subtitle="Estimation auto-entrepreneur 2024">
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Inputs ── */}
        <Card style={styles.inputCard}>
          <Text style={styles.inputTitle}>Ton chiffre d'affaires</Text>

          <View style={styles.periodeRow}>
            {(["mensuel", "annuel"] as Periode[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodeBtn, periode === p && styles.periodeBtnActive]}
                onPress={() => { setPeriode(p); setCaInput(""); }}
              >
                <Text style={[styles.periodeBtnText, periode === p && styles.periodeBtnTextActive]}>
                  {p === "mensuel" ? "Mensuel" : "Annuel"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.caInput}
            value={caInput}
            onChangeText={setCaInput}
            placeholder={
              periode === "mensuel"
                ? `Ce mois : ${currentMonthCA.toFixed(0)} €`
                : `Cette année : ${annualCA.toFixed(0)} €`
            }
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          <Text style={styles.caHint}>
            {caInput ? "" : `Données réelles utilisées · CA annuel estimé : ${caAnnuel.toFixed(0)} €`}
          </Text>

          <Text style={styles.inputLabel}>Parts fiscales</Text>
          <View style={styles.partsRow}>
            {["1", "1.5", "2", "2.5"].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.partBtn, parts === p && styles.partBtnActive]}
                onPress={() => setParts(p)}
              >
                <Text style={[styles.partBtnText, parts === p && styles.partBtnTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* ── Résultats ── */}
        <Card style={styles.resultsCard} accent="good">
          <Text style={styles.resultsTitle}>Résultat estimé sur {caAnnuel.toFixed(0)} € CA</Text>

          <ResultRow label="Cotisations URSSAF (12.3%)" value={`-${result.cotisations.toFixed(0)} €`} color={colors.urgent} />
          <ResultRow label="Formation pro (0.1%)" value={`-${result.cfp.toFixed(0)} €`} color={colors.urgent} />
          <ResultRow label="Net avant impôts" value={`${result.netAvantIR.toFixed(0)} €`} bold />
          <View style={styles.divider} />
          <ResultRow label="Revenu imposable (base IR)" value={`${result.revenuImposable.toFixed(0)} €`} color={colors.textMuted} />
          <ResultRow label="Impôt sur le revenu estimé" value={`-${result.irEstime.toFixed(0)} €`} color={colors.warning} />
          <View style={styles.divider} />
          <ResultRow
            label="NET FINAL (dans ta poche)"
            value={`${result.netApresIR.toFixed(0)} €`}
            color={colors.good}
            bold
            big
          />
          <ResultRow
            label="Taux de prélèvement effectif"
            value={`${result.tauxEffectif} %`}
            color={result.tauxEffectif > 30 ? colors.urgent : colors.textMuted}
          />

          {/* Mensualisation */}
          <View style={styles.monthly}>
            <Text style={styles.monthlyLabel}>PAR MOIS</Text>
            <View style={styles.monthlyRow}>
              <View style={styles.monthlyItem}>
                <Text style={styles.monthlyValue}>{(result.totalCharges / 12).toFixed(0)} €</Text>
                <Text style={styles.monthlyItemLabel}>à mettre de côté (charges)</Text>
              </View>
              <View style={styles.monthlyItem}>
                <Text style={[styles.monthlyValue, { color: colors.good }]}>{(result.netApresIR / 12).toFixed(0)} €</Text>
                <Text style={styles.monthlyItemLabel}>net réel / mois</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* ── Seuils ── */}
        <Card style={styles.seuilsCard}>
          <Text style={styles.seuilsTitle}>Seuils à surveiller</Text>

          <SeuilBar
            label="Franchise TVA"
            current={caAnnuel}
            max={SEUILS.franchiseTVA}
            pct={pctTVA}
            warning={pctTVA > 80}
            danger={pctTVA >= 100}
          />
          <View style={{ height: 14 }} />
          <SeuilBar
            label="Plafond micro-BIC"
            current={caAnnuel}
            max={SEUILS.plafondCA}
            pct={pctPlafond}
            warning={pctPlafond > 80}
            danger={pctPlafond >= 100}
          />
        </Card>

        {/* ── Disclaimer ── */}
        <Card>
          <Text style={styles.disclaimer}>
            ⚠️ Estimation indicative uniquement. L'IR dépend de l'ensemble de tes revenus,
            de ta situation familiale et de tes éventuelles déductions. Consulte un comptable
            pour une situation précise.
          </Text>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ModalScreen>
  );
}

function ResultRow({
  label, value, color, bold, big,
}: {
  label: string; value: string;
  color?: string; bold?: boolean; big?: boolean;
}) {
  return (
    <View style={rrStyles.row}>
      <Text style={rrStyles.label}>{label}</Text>
      <Text style={[rrStyles.value, color ? { color } : {}, bold && rrStyles.bold, big && rrStyles.big]}>
        {value}
      </Text>
    </View>
  );
}
const rrStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7 },
  label: { color: colors.textMuted, fontSize: 12, flex: 1, marginRight: 8 },
  value: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  bold: { fontWeight: "900" },
  big: { fontSize: 18 },
});

function SeuilBar({
  label, current, max, pct, warning, danger,
}: {
  label: string; current: number; max: number;
  pct: number; warning: boolean; danger: boolean;
}) {
  const barColor = danger ? colors.urgent : warning ? colors.warning : colors.good;
  const clampedPct = Math.min(pct, 100);
  return (
    <View>
      <View style={sbStyles.header}>
        <Text style={sbStyles.label}>{label}</Text>
        <Text style={[sbStyles.pct, { color: barColor }]}>
          {Math.round(pct)}% · {current.toFixed(0)} / {max.toLocaleString("fr-FR")} €
        </Text>
      </View>
      <View style={sbStyles.track}>
        <View style={[sbStyles.fill, { width: `${clampedPct}%` as any, backgroundColor: barColor }]} />
      </View>
      {danger && <Text style={sbStyles.warning}>⚠️ Seuil dépassé — contacte un comptable</Text>}
      {warning && !danger && <Text style={[sbStyles.warning, { color: colors.warning }]}>Approche du seuil</Text>}
    </View>
  );
}
const sbStyles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  pct: { fontSize: 12, fontWeight: "800" },
  track: { height: 8, backgroundColor: colors.surfaceElevated, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  warning: { color: colors.urgent, fontSize: 11, marginTop: 4, fontWeight: "700" },
});

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },

  inputCard: { marginBottom: 12 },
  inputTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", marginBottom: 14 },

  periodeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  periodeBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  periodeBtnActive: { backgroundColor: colors.goodGlow, borderColor: colors.good },
  periodeBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  periodeBtnTextActive: { color: colors.good },

  caInput: {
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: colors.textPrimary, fontSize: 20, fontWeight: "900", textAlign: "center",
  },
  caHint: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 6, marginBottom: 12 },

  inputLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  partsRow: { flexDirection: "row", gap: 8 },
  partBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  partBtnActive: { backgroundColor: colors.infoBg, borderColor: colors.info },
  partBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  partBtnTextActive: { color: colors.info },

  resultsCard: { marginBottom: 12 },
  resultsTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "900", marginBottom: 10, letterSpacing: -0.3 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 6 },

  monthly: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  monthlyLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  monthlyRow: { flexDirection: "row", gap: 12 },
  monthlyItem: { flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 10, padding: 12, alignItems: "center" },
  monthlyValue: { color: colors.textPrimary, fontSize: 20, fontWeight: "900" },
  monthlyItemLabel: { color: colors.textMuted, fontSize: 10, textAlign: "center", marginTop: 4 },

  seuilsCard: { marginBottom: 12 },
  seuilsTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", marginBottom: 14 },

  disclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 17 },
});
