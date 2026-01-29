# Battle Mode Test Plan

## Prerequisites

### Local Development
1. DynamoDB Local running: `npm run start:dynamodb`
2. Database seeded: `npm run seed:dynamodb`
3. API server running: `npm run start:api` (port 3333)
4. Frontend running: `npm run start:frontend` (port 4200)

### Production Testing
1. Frontend: https://d1ph47sejrykr7.cloudfront.net
2. REST API: https://hxhjbyvimw.us-east-1.awsapprunner.com/api
3. WebSocket: wss://ehv67k1and.execute-api.us-east-1.amazonaws.com/prod

---

## Test Categories

### Category 1: Navigation & UI

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| NAV-01 | Battle Menu loads | Navigate to `/battle` | Shows "Create Room" and "Join Room" buttons |
| NAV-02 | Create Room navigation | Click "Create Room" | Navigates to `/battle/create` |
| NAV-03 | Join Room navigation | Click "Join Room" | Navigates to `/battle/join` |
| NAV-04 | Back navigation | Click back arrow | Returns to previous screen |
| NAV-05 | Home navigation | Click home link | Returns to home page |

### Category 2: Room Creation

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| CREATE-01 | Form validation - empty name | Leave name empty, click Create | Button disabled |
| CREATE-02 | Form validation - name entered | Enter name | Button enabled |
| CREATE-03 | Create room success | Fill form, click Create | Redirects to lobby with room code |
| CREATE-04 | Room code generated | Create room | 6-character uppercase code displayed |
| CREATE-05 | Host status | Create room | Creator shown as "Host" with "Ready" |
| CREATE-06 | Settings applied | Set custom settings, create | Settings shown correctly in lobby |

### Category 3: Room Joining

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| JOIN-01 | Form validation - empty fields | Leave fields empty | Button disabled |
| JOIN-02 | Invalid room code | Enter non-existent code | Error message shown |
| JOIN-03 | Join success | Enter valid code | Redirects to lobby |
| JOIN-04 | Player appears in list | Join room | New player shown in player list |
| JOIN-05 | Room code uppercase | Enter lowercase code | Auto-converted, join works |
| JOIN-06 | Room full | Join when max players reached | Error message shown |

### Category 4: Game Lobby

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| LOBBY-01 | Room code display | Enter lobby | Room code prominently shown |
| LOBBY-02 | Settings display | Enter lobby | Time, logos, max players shown |
| LOBBY-03 | Player list | Enter lobby | All players listed |
| LOBBY-04 | Ready toggle | Click Ready button | Status changes, broadcasted |
| LOBBY-05 | Start disabled | Not all ready | Start button disabled |
| LOBBY-06 | Start enabled | All ready, min players | Start button enabled |
| LOBBY-07 | Host-only start | Non-host view | No Start button visible |
| LOBBY-08 | Leave room | Click Leave | Returns to menu, removed from room |
| LOBBY-09 | Host leaves | Host disconnects | All players notified, room cancelled |
| LOBBY-10 | Player leaves | Player disconnects | Removed from list, others stay |

### Category 5: Gameplay

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| GAME-01 | Logo display | Game starts | Obfuscated logo image shown |
| GAME-02 | Letters display | Game starts | Scrambled letters as clickable tiles |
| GAME-03 | Letter selection | Click letter | Letter added to guess |
| GAME-04 | Letter removal | Click guessed letter | Letter returned to options |
| GAME-05 | Keyboard input | Press letter key | Letter added to guess |
| GAME-06 | Backspace | Press Backspace | Last letter removed |
| GAME-07 | Auto-submit | Fill all slots | Answer automatically submitted |
| GAME-08 | Correct answer | Submit correct guess | Success feedback, points awarded |
| GAME-09 | Wrong answer | Submit wrong guess | Error feedback, can retry |
| GAME-10 | Timer display | During game | Timer counts down |
| GAME-11 | Timer urgent | ≤10 seconds | Timer turns red |
| GAME-12 | Leaderboard | During game | Top players shown |
| GAME-13 | Score update | Correct answer | Score increments, leaderboard updates |
| GAME-14 | Next logo | After correct | New logo displayed |
| GAME-15 | Logo progress | During game | "Logo X of Y" shown |

### Category 6: Game End

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| END-01 | Timer expiry | Wait for timer | Game ends, scoreboard shown |
| END-02 | All logos guessed | Complete all logos | Game ends early |
| END-03 | Final rankings | Game ends | All players ranked |
| END-04 | Medals | Top 3 players | Gold, silver, bronze medals |
| END-05 | Winner display | Game ends | Winner name and score shown |
| END-06 | Play again | Click Play Again | Returns to menu, state reset |
| END-07 | Stats display | Game ends | Correct/total, game time shown |

### Category 7: Error Handling

| Test ID | Description | Steps | Expected Result |
|---------|-------------|-------|-----------------|
| ERR-01 | Socket disconnect | Kill API server | Error message shown |
| ERR-02 | Reconnection | Restart API server | Reconnects or shows error |
| ERR-03 | Invalid state | Direct URL to game | Redirects to menu |

---

## Production-Specific Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| PROD-01 | WebSocket connects | Connection established to API Gateway |
| PROD-02 | Client-side timer | Timer counts down locally (no server ticks) |
| PROD-03 | Speed bonus | Correct answers give 100 + speed bonus |
| PROD-04 | Exact letter count | Only answer letters shown (no extras) |
| PROD-05 | Max players 100 | Can support up to 100 players |

### WebSocket Connection Test (Node.js)
```javascript
const WebSocket = require('ws');
const ws = new WebSocket('wss://ehv67k1and.execute-api.us-east-1.amazonaws.com/prod');
ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    action: 'message',
    event: 'room:create',
    data: { displayName: 'TestHost' }
  }));
});
ws.on('message', (data) => console.log('Received:', data.toString()));
```

---

## Test Scripts (Playwright MCP)

### Script 1: Room Creation Flow

```
1. Navigate to https://d1ph47sejrykr7.cloudfront.net/battle (or http://localhost:4200/battle for local)
2. Verify "Create Room" button visible
3. Click "Create Room"
4. Verify URL is /battle/create
5. Verify "Create Room" button disabled (no name)
6. Type "TestHost" in name field
7. Verify "Create Room" button enabled
8. Click "Create Room"
9. Wait for navigation to /battle/lobby/*
10. Verify room code displayed (6 chars)
11. Verify "TestHost" shown as Host
12. Verify settings: 120s, 10 logos, 8 max
13. Take screenshot
```

### Script 2: Room Joining Flow

```
1. [Tab 1] Create room as "Player1", note room code
2. [Tab 2] Navigate to http://localhost:4200/battle/join
3. Type "Player2" in name field
4. Type room code from step 1
5. Click "Join Room"
6. Verify URL is /battle/lobby/{code}
7. [Tab 1] Verify "Player2" appears in player list
8. [Tab 2] Verify "Player1" shown as Host
9. Take screenshot of both tabs
```

### Script 3: Ready Up Flow

```
1. [Tab 1] Create room as "Host"
2. [Tab 2] Join room as "Player2"
3. [Tab 1] Verify "Start Game" disabled
4. [Tab 2] Click "Ready" button
5. [Tab 2] Verify status shows "Ready"
6. [Tab 1] Verify Player2 shows "Ready"
7. [Tab 1] Verify "Start Game" still disabled (only 1 other player, min 2 needed means total 2 players including host, so this should actually be enabled)
8. Actually verify "Start Game" is enabled since we have 2 players (host + 1)
9. Take screenshot
```

### Script 4: Game Start Flow

```
1. Create room with 2 players, both ready
2. [Tab 1] Click "Start Game"
3. Verify both tabs show game interface
4. Verify logo image displayed
5. Verify letter tiles displayed
6. Verify timer started
7. Verify "Logo 1 of 10" shown
8. Take screenshot
```

### Script 5: Guessing Flow

```
1. Start game with 2 players
2. Get current logo letters
3. Click letters to spell correct answer
4. Verify auto-submit occurs
5. Verify success feedback shown
6. Verify score increases
7. Verify next logo appears
8. Take screenshot
```

### Script 6: Game End Flow

```
1. Start game with short timer (60s) or few logos (5)
2. Wait for game to end
3. Verify scoreboard displayed
4. Verify rankings shown
5. Verify winner highlighted
6. Verify "Play Again" button works
7. Take screenshot
```

---

## Manual Test Checklist

### Pre-Game Tests
- [ ] NAV-01: Battle menu loads correctly
- [ ] NAV-02: Can navigate to Create Room
- [ ] NAV-03: Can navigate to Join Room
- [ ] CREATE-01: Cannot create with empty name
- [ ] CREATE-03: Can create room successfully
- [ ] CREATE-04: Room code is 6 characters
- [ ] JOIN-02: Error shown for invalid code
- [ ] JOIN-03: Can join valid room

### Lobby Tests
- [ ] LOBBY-01: Room code displayed
- [ ] LOBBY-02: Settings displayed correctly
- [ ] LOBBY-03: All players shown
- [ ] LOBBY-04: Ready toggle works
- [ ] LOBBY-06: Start enables when ready
- [ ] LOBBY-08: Leave room works

### Gameplay Tests
- [ ] GAME-01: Logo image displays
- [ ] GAME-02: Letter tiles display
- [ ] GAME-03: Can select letters
- [ ] GAME-07: Auto-submit works
- [ ] GAME-08: Correct answer gives points
- [ ] GAME-10: Timer counts down
- [ ] GAME-14: Next logo after correct

### End Game Tests
- [ ] END-01: Game ends on timer
- [ ] END-03: Rankings shown
- [ ] END-06: Play again works

---

## Performance Tests

| Test ID | Description | Threshold |
|---------|-------------|-----------|
| PERF-01 | Room creation time | < 500ms |
| PERF-02 | Answer submission time | < 200ms |
| PERF-03 | Logo load time | < 1s |
| PERF-04 | Timer update frequency | 1s ± 100ms |

---

## Integration Test Scenarios

### Scenario A: Full 2-Player Game
1. Player 1 creates room with 5 logos, 60s timer
2. Player 2 joins room
3. Player 2 clicks Ready
4. Player 1 starts game
5. Both players guess logos
6. One player gets more correct
7. Game ends, verify correct winner

### Scenario B: Host Disconnect
1. Player 1 creates room
2. Player 2 joins and readies
3. Player 1 closes browser
4. Verify Player 2 sees "Room cancelled"

### Scenario C: Maximum Players
1. Create room with max 4 players
2. Players 2, 3, 4 join
3. Player 5 tries to join
4. Verify error "Room full"

---

## Bug Tracking

| Bug ID | Description | Severity | Status |
|--------|-------------|----------|--------|
| | | | |

---

## Test Results Template

| Date | Tester | Tests Passed | Tests Failed | Notes |
|------|--------|--------------|--------------|-------|
| | | | | |
