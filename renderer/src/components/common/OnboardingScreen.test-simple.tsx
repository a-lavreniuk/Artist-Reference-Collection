/**
 * Простейшая тестовая страница для проверки роутинга
 */

export const OnboardingScreenTestSimple = () => {
  console.log('✅ Тестовая страница рендерится!');
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#FF6B6B',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      color: 'white',
      fontSize: '24px',
      fontWeight: 'bold',
      zIndex: 9999,
    }}>
      <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>
        🎨 Тестовая страница работает!
      </h1>
      <p style={{ fontSize: '18px' }}>
        Если вы видите этот экран, значит роутинг работает корректно
      </p>
      <p style={{ fontSize: '14px', marginTop: '20px', opacity: 0.8 }}>
        URL: /test/onboarding-simple
      </p>
    </div>
  );
};

export default OnboardingScreenTestSimple;

