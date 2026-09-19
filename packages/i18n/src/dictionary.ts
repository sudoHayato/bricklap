import type { Sport } from "@bricklap/engine";

/**
 * Shape of every Bricklap translation dictionary. This is a plain TypeScript
 * type (not derived with `typeof` from the `en` dictionary), so both `en.ts`
 * and `pt-PT.ts` are checked against the SAME shape independently: a key
 * missing from either file — or a stray extra key — is a compile error, not
 * a runtime surprise.
 *
 * `sport` is keyed by `Sport` on purpose: adding a fifth sport to the engine
 * forces both dictionaries to describe it before the build passes.
 */
export type Dictionary = {
  common: {
    start: string;
    stop: string;
    change: string;
    cancel: string;
    done: string;
    home: string;
    back: string;
    discard: string;
    distance: string;
    pace: string;
    speed: string;
    segments: string;
    time: string;
    summary: string;
    phone: string;
    live: string;
    openingSession: string;
    watch: string;
    close: string;
    continue: string;
    /** "Marca": fecha um bloco sem mudar de desporto (Fase 4). */
    mark: string;
    delete: string;
    keep: string;
    settings: string;
  };
  sport: Record<Sport, { label: string; live: string }>;
  footer: {
    preLaunch: string;
    privacy: string;
    cookies: string;
    terms: string;
    copyright: string;
  };
  home: {
    kicker: string;
    eyebrow: string;
    taglineLine1: string;
    taglineLine2: string;
    subtitle: string;
    liveBadge: string;
    openWatch: string;
    firstSport: string;
    startOnWatch: string;
    history: string;
    noSessions: string;
  };
  live: {
    noLiveSession: string;
    segment: string;
    nextSportTitle: string;
    nextSportCopy: string;
    endSessionTitle: string;
    endSessionCopy: string;
    endSessionConfirm: string;
  };
  summary: {
    notFound: string;
    segmentsOne: string;
    segmentsOther: string;
    deleteSession: string;
  };
  watch: {
    kicker: string;
    laps: string;
    idleHint: string;
    disclaimer: string;
    liveLog: string;
    lap: string;
  };
  trackMap: {
    ariaLabel: string;
    waitingForMovement: string;
  };
  mobile: {
    kicker: string;
    initialSport: string;
    idleHint: string;
    totalDistanceLabel: string;
    currentSegment: string;
    changeTo: string;
    newSession: string;
    samples: string;
    liveSuffix: string;
    opening: string;
    history: string;
    noSessions: string;
    resumeTitle: string;
    resumeCopy: string;
    inProgress: string;
    discarded: string;
    kickerSim: string;
    gpsSource: string;
    gpsReal: string;
    gpsSim: string;
    gpsWaiting: string;
    gpsWeak: string;
    gpsUnavailable: string;
    samplesSaved: string;
    locationRationale: string;
    locationDenied: string;
    locationBlocked: string;
    locationServicesOff: string;
    openSettings: string;
    /** Picker headings: sports recorded with GPS vs. time-only ones (ADR 0008). */
    sportGroupOutdoor: string;
    sportGroupIndoor: string;
    /** Short GPS-line reasons when a GPS segment cannot get fixes mid-session. */
    gpsNoPermission: string;
    gpsServicesOff: string;
    /** Pace / speed over the last 30 s of the current segment (ADR 0009), next to the segment average. */
    currentPace: string;
    currentSpeed: string;
    /** Export button in the history screen and its failure line. */
    exportData: string;
    exportFailed: string;
    /**
     * The persistent notification while a session records in the background
     * (ADR 0010). Title takes `{sport}`, body takes `{startedAt}`, and
     * neither carries elapsed time: the text is an option of the location
     * task, so it only changes at START, CHANGE and resume, and a clock in
     * it would sit frozen — which the founder read as broken (session 09).
     * The clock that runs is inside the app.
     */
    recordingNotificationTitle: string;
    recordingNotificationBody: string;
    /** Battery-optimisation exemption: the idle-screen card that asks, and the live-screen warning while it is missing. */
    batteryExemptionCopy: string;
    batteryExemptionButton: string;
    batteryWarning: string;
    /** Notification permission (Android 13+): the idle-screen card that asks, its button, and the live-screen warning while it is missing. */
    notificationsCopy: string;
    notificationsButton: string;
    notificationsWarning: string;
    /**
     * Fase 4 — o sistema visual de docs/DESIGN.md na app. Blocos e marcas
     * (o evento Marca), o ecrã de definições com o seletor de tema, e o
     * apagar de uma sessão do histórico (DELETE real, ADR 0006).
     */
    startTitle: string;
    startSubtitle: string;
    gymGroup: string;
    streetGroup: string;
    tabHome: string;
    tabHistory: string;
    blocksOne: string;
    blocksOther: string;
    marksOne: string;
    marksOther: string;
    sessionsOne: string;
    sessionsOther: string;
    since: string;
    blocksSection: string;
    currentBlock: string;
    lap: string;
    /** A escolha do Mudar (sessão 17): o desporto que já está a decorrer, não selecionável. */
    currentSportTag: string;
    deleteAsk: string;
    deleteDone: string;
    themeTitle: string;
    themeLight: string;
    themeLightCopy: string;
    themeDark: string;
    themeDarkCopy: string;
    themeHybrid: string;
    themeHybridCopy: string;
    themeSystem: string;
    themeSystemCopy: string;
    themeDefault: string;
    themeNote: string;
    unitsTitle: string;
    unitsMetric: string;
    unitsMetricDetail: string;
    aboutTitle: string;
    aboutCopy: string;
    /**
     * ADR 0011 (sessão 26): rondas e valores registados. O botão Ronda, a
     * ficha de valores (as duas portas: durante o treino e no fim), os
     * campos por desporto e a marca de origem dos números.
     */
    round: string;
    roundN: string;
    newRound: string;
    noRound: string;
    record: string;
    recordTitle: string;
    thisBlock: string;
    previousBlock: string;
    blockContext: string;
    exercise: string;
    exercisePlaceholder: string;
    meters: string;
    split: string;
    speed: string;
    reps: string;
    load: string;
    computedFromSpeed: string;
    computedFromDistance: string;
    computedSplit: string;
    later: string;
    save: string;
    clear: string;
    declaredTag: string;
    nothingToRecord: string;
    tapToRecord: string;
    perSport: string;
    declaredDistance: string;
    /** "Nova ronda · {n}": the button says which round it opens, because round 1 opens with the session. */
    newRoundN: string;
    /** The short mark next to any number that is declared or derived from a declared one (ADR 0011 §3a). */
    declaredShort: string;
    declaredLegend: string;
    measuredDistance: string;
    exerciseKind: string;
    kindFreeWeight: string;
    kindFreeWeightDetail: string;
    kindBodyweight: string;
    kindBodyweightDetail: string;
  };
  meta: {
    title: string;
    description: string;
  };
};
