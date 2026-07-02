# Flappy Bird Clone

A complete Flappy Bird clone built with pure HTML5, CSS3, and vanilla JavaScript. No frameworks, no libraries, no external assets.

## Features

- Pure HTML5 Canvas rendering
- Smooth 60fps gameplay via requestAnimationFrame
- Responsive design that works on desktop and mobile
- Touch and keyboard controls
- Local storage for best score persistence
- Smooth physics and animations
- Visual polish: bird rotation, squish animation, screen flash on death

## How to Play

1. Open `index.html` in a web browser
2. Press Space bar (desktop) or tap the screen (mobile) to start
3. Press Space or tap to make the bird flap and stay in the air
4. Avoid hitting the pipes or the ground
5. Score points by passing through pipe gaps
6. Try to beat your best score!

## Controls

- **Desktop**: Space bar to flap
- **Mobile**: Tap anywhere on the screen to flap

## Game Mechanics

- Bird falls continuously due to gravity
- Each flap gives the bird an upward boost
- Pipes spawn from the right and move left at constant speed
- Collision with pipes or ground ends the game
- Score increases by 1 for each pipe pair passed
- Best score is saved to browser local storage

## Technical Details

- **Canvas Size**: Responsive, max 480x640px
- **Physics**: Gravity 0.5, flap velocity -8, max fall speed 12
- **Pipe Gap**: 150px
- **Pipe Width**: 60px
- **Spawn Interval**: 1.8 seconds
- **Game States**: IDLE, PLAYING, DEAD

## File Structure

```
flappy-bird/
├── index.html    # Main HTML structure
├── style.css     # Styling and layout
├── game.js       # Game logic and canvas rendering
└── README.md     # This file
```

## Browser Compatibility

Works in all modern browsers that support HTML5 Canvas:
- Chrome
- Firefox
- Safari
- Edge

## Development

No build process required. Simply open `index.html` in a browser to run the game.

To modify:
- Edit `game.js` for game logic and physics
- Edit `style.css` for UI styling
- Edit `index.html` for structure

## License

Free to use and modify for personal and educational purposes.
