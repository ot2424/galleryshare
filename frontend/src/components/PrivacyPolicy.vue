<template>
  <div class="page-shell min-h-screen px-4 py-8 sm:px-6 sm:py-10">
    <div class="mx-auto max-w-5xl">
      <section class="glass-panel rounded-[2rem] p-6 sm:p-8">
        <div class="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div class="max-w-3xl">
            <span class="eyebrow">Datenschutz</span>
            <h1 class="mt-5 text-4xl text-[var(--ink)] sm:text-5xl">Hinweise zur Verarbeitung personenbezogener Daten</h1>
            <p class="mt-5 text-base leading-7 text-[var(--muted)]">
              Diese Datenschutzhinweise beschreiben in allgemeiner Form, wie personenbezogene Daten im Rahmen der Nutzung
              von GalleryShare verarbeitet werden. Sie sollen transparent erklären, welche Daten für den technischen
              Betrieb, den Upload, die Bereitstellung und den Download von Medien verarbeitet werden können.
            </p>
          </div>

          <router-link class="secondary-button" to="/">Zur Startseite</router-link>
        </div>
      </section>

      <section class="mt-6 grid gap-6">
        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">1. Verantwortliche Stelle</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Verantwortlich für die Datenverarbeitung im Zusammenhang mit dieser Webseite ist der jeweilige Betreiber
              dieses Angebots. Bei Fragen oder Anliegen zum Datenschutz können Sie sich an die verantwortliche Stelle wenden.
            </p>
            <p>
              Onur Toraman<br />
              E-Mail: onur.t@aol.com
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">2. Zweck der Verarbeitung</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Die Plattform dient der privaten oder projektbezogenen Bereitstellung von Bildern und Videos über
              geschützte Galerie-Links. Personenbezogene Daten werden nur insoweit verarbeitet, wie dies technisch und
              organisatorisch notwendig ist, um Galerien anzulegen, Uploads zu ermöglichen, Inhalte bereitzustellen,
              Dateien herunterzuladen und die Systemsicherheit zu gewährleisten.
            </p>
            <p>
              Die Verarbeitung kann insbesondere zur Galerieverwaltung, zur Zugriffskontrolle, zur Fehleranalyse, zur
              Missbrauchsverhinderung sowie zur zeitlich begrenzten Bereitstellung von Medien erfolgen.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">3. Welche Daten verarbeitet werden können</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Beim Aufruf der Website können technisch erforderliche Verbindungsdaten verarbeitet werden. Hierzu gehören
              insbesondere IP-Adresse, Datum und Uhrzeit des Zugriffs, aufgerufene URL, übertragene Datenmenge,
              Browsertyp, Betriebssystem, Referrer sowie weitere Informationen, die für den sicheren Betrieb und die
              Auslieferung der Inhalte erforderlich sind.
            </p>
            <p>
              Im Rahmen der Galerie-Nutzung können ausserdem Dateiinhalte, Dateinamen, Galeriebezeichnungen,
              Ablaufzeitpunkte, technische Dateimetadaten sowie systemseitige Verarbeitungsinformationen gespeichert und
              verarbeitet werden. Sofern Uploads vorgenommen werden, können die hochgeladenen Dateien und die zugehörigen
              technischen Angaben verarbeitet werden, um die Inhalte innerhalb der Galerie verfügbar zu machen.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">4. Rechtsgrundlagen</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Die Verarbeitung erfolgt je nach konkreter Nutzung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, soweit die
              Datenverarbeitung zur Bereitstellung der gewünschten Galerie oder zur Durchführung vorvertraglicher oder
              vertraglicher Maßnahmen erforderlich ist. Soweit Daten zur Gewährleistung der Stabilität, Sicherheit und
              Funktionsfähigkeit der Website verarbeitet werden, erfolgt dies auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO.
            </p>
            <p>
              Sofern im Einzelfall eine Einwilligung eingeholt wird, erfolgt die Verarbeitung auf Grundlage von Art. 6 Abs. 1
              lit. a DSGVO. Eine erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">5. Hosting, Speicherung und technische Dienstleister</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Diese Website kann auf einem externen Server oder bei einem Infrastruktur-Anbieter gehostet werden. Darüber
              hinaus können externe technische Dienste für die Speicherung, Auslieferung und den Download von Dateien
              eingebunden sein, sofern dies für die Funktion der Galerie erforderlich ist.
            </p>
            <p>
              Nach Ihrer derzeitigen technischen Struktur sollten an dieser Stelle insbesondere die eingesetzten Anbieter
              konkret benannt werden, etwa der Server-Hoster, ein Object-Storage-Anbieter für Medien sowie ein CDN- oder
              Download-Anbieter für die Auslieferung großer Dateien. Bitte ergänzen Sie hier die tatsächlich genutzten
              Dienste, beispielsweise Hetzner für das Server-Hosting, Cloudflare R2 für die Medienspeicherung und Bunny
              für die Auslieferung von ZIP-Dateien, sofern diese Dienste im produktiven Betrieb verwendet werden.
            </p>
            <p>
              Soweit externe Anbieter als Auftragsverarbeiter eingesetzt werden, sollte der Einsatz auf Grundlage eines
              Vertrages zur Auftragsverarbeitung erfolgen, sofern dies datenschutzrechtlich erforderlich ist.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">6. Speicherdauer</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Personenbezogene Daten werden nicht länger gespeichert, als dies für die genannten Zwecke erforderlich ist.
              Galerieinhalte können zeitlich begrenzt verfügbar sein und nach Ablauf der vorgesehenen Frist automatisiert
              entfernt oder deaktiviert werden.
            </p>
            <p>
              Technische Protokoll- und Systemdaten können für einen begrenzten Zeitraum gespeichert werden, soweit dies zur
              Gewährleistung der Sicherheit, zur Fehleranalyse oder zur Durchsetzung berechtigter Interessen erforderlich ist.
              Gesetzliche Aufbewahrungspflichten bleiben unberührt.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">7. Schutz der Daten</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Es werden angemessene technische und organisatorische Maßnahmen getroffen, um personenbezogene Daten gegen
              unbefugten Zugriff, Verlust, Manipulation oder unberechtigte Offenlegung zu schützen. Dazu können insbesondere
              Zugriffsbeschränkungen, zeitlich begrenzte Freigaben, sichere Verbindungen sowie interne Schutzmaßnahmen für
              gespeicherte Inhalte gehören.
            </p>
            <p>
              Trotz aller getroffenen Maßnahmen kann eine vollständige Sicherheit bei der Datenübertragung im Internet
              nicht garantiert werden. Nutzer sollten deshalb Links zu Galerien vertraulich behandeln und nicht unkontrolliert
              weitergeben.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">8. Rechte betroffener Personen</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Betroffene Personen haben nach Maßgabe der gesetzlichen Vorschriften das Recht auf Auskunft über die
              verarbeiteten personenbezogenen Daten, auf Berichtigung unrichtiger Daten, auf Löschung, auf Einschränkung
              der Verarbeitung sowie auf Datenübertragbarkeit, soweit die jeweiligen Voraussetzungen vorliegen.
            </p>
            <p>
              Soweit eine Verarbeitung auf berechtigten Interessen beruht, besteht zudem das Recht, aus Gründen, die sich
              aus der besonderen Situation der betroffenen Person ergeben, Widerspruch gegen die Verarbeitung einzulegen.
              Darüber hinaus besteht ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde.
            </p>
          </div>
        </article>

        <article class="soft-card rounded-[1.75rem] p-6 sm:p-8">
          <h2 class="text-2xl text-[var(--ink)]">9. Hinweis zur Aktualisierung</h2>
          <div class="mt-4 space-y-4 text-sm leading-7 text-[var(--muted)] sm:text-base">
            <p>
              Diese Datenschutzhinweise können angepasst werden, wenn sich technische Prozesse, gesetzliche Anforderungen
              oder eingesetzte Dienstleister ändern. Es gilt jeweils die auf dieser Website veröffentlichte Fassung.
            </p>
            <p>
              Bitte beachten Sie, dass diese Vorlage noch um Ihre konkreten Anbieter-, Kontakt- und Unternehmensdaten
              ergänzt werden sollte, damit sie zu Ihrem produktiven Einsatz passt.
            </p>
          </div>
        </article>
      </section>
    </div>
  </div>
</template>
