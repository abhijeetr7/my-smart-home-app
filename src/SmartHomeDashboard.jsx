import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, collection, onSnapshot, getDocs, query, where, addDoc } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, Lightbulb, Fan, Droplet, Sun, Zap, Check, X, Plus } from 'lucide-react';

// Firebase configuration and initialization from global variables
// These variables are provided by the hosting environment for seamless deployment.
// For local development, you would replace these with your own Firebase project credentials.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Mock device data for initial setup when the Firestore collection is empty.
const mockDevices = [
  { id: 'thermostat-1', name: 'Living Room Thermostat', type: 'thermostat', targetTemp: 72, currentTemp: 75, room: 'Living Room' },
  { id: 'light-1', name: 'Main Living Light', type: 'light', isOn: true, brightness: 80, room: 'Living Room' },
  { id: 'fan-1', name: 'Ceiling Fan', type: 'fan', isOn: false, speed: 0, room: 'Living Room' },
  { id: 'light-2', name: 'Kitchen Light', type: 'light', isOn: false, brightness: 50, room: 'Kitchen' },
  { id: 'humidity-1', name: 'Bedroom Humidifier', type: 'humidity', humidity: 45, room: 'Bedroom' },
  { id: 'light-3', name: 'Bedroom Lamp', type: 'light', isOn: true, brightness: 60, room: 'Bedroom' },
];

// Helper to convert Firebase Timestamp object to a readable time string.
const formatTimestamp = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// Main App Component
const App = () => {
  // State variables for managing application data and UI
  const [userId, setUserId] = useState(null);
  const [devices, setDevices] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [rules, setRules] = useState([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    triggerDevice: '',
    triggerCondition: '',
    triggerValue: '',
    actionDevice: '',
    actionType: '',
    actionValue: '',
  });
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  // 1. Firebase Authentication and Initialization
  // This useEffect runs once on component mount to handle user authentication.
  useEffect(() => {
    const initializeAppAndAuth = async () => {
      try {
        if (initialAuthToken) {
          await signInWithCustomToken(auth, initialAuthToken);
        } else {
          await signInAnonymously(auth);
        }
        setUserId(auth.currentUser.uid);
        setIsAuthReady(true);
      } catch (e) {
        console.error("Error during authentication:", e);
        setIsAuthReady(true); // Still proceed to allow anonymous use in case of error.
      }
    };
    initializeAppAndAuth();
  }, []);

  // 2. Real-time data synchronization from Firestore
  // This useEffect sets up listeners for devices, history, and rules.
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    // Define Firestore collection references
    const deviceCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/devices`);
    const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/history`);
    const rulesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/rules`);

    // Listen for real-time device changes
    const unsubDevices = onSnapshot(deviceCollectionRef, (snapshot) => {
      const deviceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDevices(deviceList);

      // If no devices exist, initialize the collection with mock data
      if (deviceList.length === 0) {
        mockDevices.forEach(async (device) => {
          await setDoc(doc(deviceCollectionRef, device.id), device);
        });
      }
    });

    // Listen for real-time history data changes
    const unsubHistory = onSnapshot(historyCollectionRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Filter for a specific device and sort to prepare for charting.
      data.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());
      const filteredHistory = data.filter(d => d.deviceId === 'thermostat-1');
      setHistoryData(filteredHistory.slice(-30)); // Keep only the last 30 data points for performance.
    });

    // Listen for real-time automation rules changes
    const unsubRules = onSnapshot(rulesCollectionRef, (snapshot) => {
      setRules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Cleanup function to detach listeners when the component unmounts
    return () => {
      unsubDevices();
      unsubHistory();
      unsubRules();
    };
  }, [isAuthReady, userId]);

  // 3. Simulated IoT Hub (generates mock data)
  // This useEffect simulates an external system generating data and pushing it to Firestore.
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const historyCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/history`);

    const intervalId = setInterval(() => {
      const now = new Date();
      // Generate mock data every minute.
      if (now.getMinutes() % 1 === 0 && now.getSeconds() === 0) {
        // Generate a random temperature change.
        const randomTempChange = (Math.random() - 0.5) * 1.5;
        const newTemp = devices.find(d => d.id === 'thermostat-1')?.currentTemp + randomTempChange || 75;

        // Add a new document to the history collection.
        addDoc(historyCollectionRef, {
          deviceId: 'thermostat-1',
          value: newTemp,
          timestamp: now,
        }).catch(e => console.error("Error adding history data: ", e));

        // Update the current device state in the devices collection.
        updateDoc(doc(db, `artifacts/${appId}/users/${userId}/devices/thermostat-1`), {
          currentTemp: newTemp
        }).catch(e => console.error("Error updating device temp: ", e));
      }
    }, 1000); // Check every second to be precise on the minute mark.

    return () => clearInterval(intervalId);
  }, [devices, isAuthReady, userId]);

  // 4. Automation Rules Engine
  // This useEffect checks the rules against the current device states in real time.
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    
    // Iterate through all configured rules.
    rules.forEach(rule => {
      const triggerDevice = devices.find(d => d.id === rule.triggerDevice);
      if (!triggerDevice) return; // Skip if the trigger device doesn't exist.

      let conditionMet = false;
      const triggerValue = parseFloat(rule.triggerValue);

      // Check the rule's condition based on the device's type.
      switch (rule.triggerCondition) {
        case '>':
          if (triggerDevice.currentTemp > triggerValue) conditionMet = true;
          break;
        case '<':
          if (triggerDevice.currentTemp < triggerValue) conditionMet = true;
          break;
        case '==':
          if (triggerDevice.isOn === (rule.triggerValue === 'on')) conditionMet = true;
          break;
      }

      // If the condition is met, trigger the action.
      if (conditionMet) {
        const actionDeviceRef = doc(db, `artifacts/${appId}/users/${userId}/devices/${rule.actionDevice}`);
        const actionValue = rule.actionType === 'toggle' ? (rule.actionValue === 'on') : parseFloat(rule.actionValue);
        
        // Prevent infinite loops by ensuring the action is not already in the desired state.
        const actionDevice = devices.find(d => d.id === rule.actionDevice);
        if (actionDevice && actionDevice.isOn !== actionValue) {
           updateDoc(actionDeviceRef, {
            isOn: actionValue
          }).catch(e => console.error("Error updating action device:", e));
          setFeedback({ message: `Rule triggered: ${rule.name}`, type: 'success' });
        }
      }
    });
  }, [devices, rules, isAuthReady, userId]);

  // --- UI Handlers ---

  // Handles toggling a device's on/off state.
  const handleToggle = (id, currentStatus) => {
    const deviceRef = doc(db, `artifacts/${appId}/users/${userId}/devices/${id}`);
    updateDoc(deviceRef, { isOn: !currentStatus }).catch(e => console.error("Error toggling device:", e));
  };

  // Handles slider changes for devices like thermostats and lights.
  const handleSliderChange = (id, key, value) => {
    const deviceRef = doc(db, `artifacts/${appId}/users/${userId}/devices/${id}`);
    updateDoc(deviceRef, { [key]: value }).catch(e => console.error("Error updating device value:", e));
  };

  // Handles the submission of a new automation rule form.
  const handleRuleSubmit = async (e) => {
    e.preventDefault();
    if (!newRule.name || !newRule.triggerDevice || !newRule.actionDevice) {
      setFeedback({ message: 'All fields are required.', type: 'error' });
      return;
    }

    try {
      const rulesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/rules`);
      await addDoc(rulesCollectionRef, newRule);
      setFeedback({ message: 'Rule created successfully!', type: 'success' });
      setShowRuleModal(false);
      // Reset the form after successful submission.
      setNewRule({
        name: '', triggerDevice: '', triggerCondition: '', triggerValue: '',
        actionDevice: '', actionType: '', actionValue: ''
      });
    } catch (e) {
      console.error("Error adding rule: ", e);
      setFeedback({ message: 'Failed to create rule.', type: 'error' });
    }
  };
  
  // --- UI Components ---

  // Renders a single device card based on its type.
  const renderDeviceCard = (device) => {
    const cardBaseClasses = "relative bg-white/50 backdrop-blur-md rounded-2xl shadow-xl p-6 transition-transform duration-300 ease-in-out hover:scale-[1.02] transform-gpu border border-white/20";
    const titleClasses = "text-xl font-semibold mb-1 flex items-center gap-2";
    const subTitleClasses = "text-sm text-gray-700";
    
    switch (device.type) {
      case 'thermostat':
        return (
          <div key={device.id} className={`${cardBaseClasses} bg-gradient-to-br from-blue-100 to-blue-200`}>
            <div className={titleClasses}>
              <Thermometer className="w-6 h-6 text-blue-600" />
              {device.name}
            </div>
            <p className={subTitleClasses}>{device.room}</p>
            <div className="flex flex-col items-center justify-center my-4">
              <div className="text-6xl font-extrabold text-blue-800">{Math.round(device.currentTemp)}°F</div>
              <p className="mt-1 text-sm text-gray-600">Target: {device.targetTemp}°F</p>
            </div>
            <input
              type="range"
              min="60"
              max="85"
              value={device.targetTemp}
              onChange={(e) => handleSliderChange(device.id, 'targetTemp', parseFloat(e.target.value))}
              className="w-full h-2 bg-blue-300 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        );
      case 'light':
        return (
          <div key={device.id} className={`${cardBaseClasses} ${device.isOn ? 'bg-gradient-to-br from-yellow-100 to-yellow-200' : 'bg-gradient-to-br from-gray-100 to-gray-200'}`}>
            <div className={titleClasses}>
              <Lightbulb className={`w-6 h-6 ${device.isOn ? 'text-yellow-600' : 'text-gray-600'}`} />
              {device.name}
            </div>
            <p className={subTitleClasses}>{device.room}</p>
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => handleToggle(device.id, device.isOn)}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors duration-300 ${
                  device.isOn ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg' : 'bg-gray-400 hover:bg-gray-500 text-gray-800'
                }`}
              >
                {device.isOn ? 'ON' : 'OFF'}
              </button>
            </div>
            {device.isOn && (
              <div className="mt-4">
                <p className="text-gray-700 text-sm mb-2">Brightness: {device.brightness}%</p>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={device.brightness}
                  onChange={(e) => handleSliderChange(device.id, 'brightness', parseFloat(e.target.value))}
                  className="w-full h-2 bg-yellow-300 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        );
      case 'fan':
        return (
          <div key={device.id} className={`${cardBaseClasses} ${device.isOn ? 'bg-gradient-to-br from-teal-100 to-teal-200' : 'bg-gradient-to-br from-gray-100 to-gray-200'}`}>
            <div className={titleClasses}>
              <Fan className={`w-6 h-6 ${device.isOn ? 'text-teal-600' : 'text-gray-600'}`} />
              {device.name}
            </div>
            <p className={subTitleClasses}>{device.room}</p>
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => handleToggle(device.id, device.isOn)}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors duration-300 ${
                  device.isOn ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg' : 'bg-gray-400 hover:bg-gray-500 text-gray-800'
                }`}
              >
                {device.isOn ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        );
      case 'humidity':
        return (
          <div key={device.id} className={`${cardBaseClasses} bg-gradient-to-br from-indigo-100 to-indigo-200`}>
            <div className={titleClasses}>
              <Droplet className="w-6 h-6 text-indigo-600" />
              {device.name}
            </div>
            <p className={subTitleClasses}>{device.room}</p>
            <div className="flex flex-col items-center justify-center my-4">
              <div className="text-5xl font-extrabold text-indigo-800">{device.humidity}%</div>
              <p className="mt-1 text-sm text-gray-600">Current Humidity</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Renders the modal for creating a new automation rule.
  const renderRuleModal = () => (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl transform transition-all scale-95 duration-300 ease-out sm:scale-100">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Create Automation Rule</h2>
        <form onSubmit={handleRuleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Rule Name</label>
            <input
              type="text"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">If this device...</label>
              <select
                className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={newRule.triggerDevice}
                onChange={(e) => setNewRule({ ...newRule, triggerDevice: e.target.value })}
                required
              >
                <option value="">Select Device</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">is...</label>
              <select
                className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={newRule.triggerCondition}
                onChange={(e) => setNewRule({ ...newRule, triggerCondition: e.target.value })}
                required
              >
                <option value="">Condition</option>
                <option value=">">Greater than</option>
                <option value="<">Less than</option>
                <option value="==">is on/off</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Then set its value to...</label>
            <input
              type="text"
              className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="e.g., 75, on, off"
              value={newRule.triggerValue}
              onChange={(e) => setNewRule({ ...newRule, triggerValue: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Then this device...</label>
              <select
                className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={newRule.actionDevice}
                onChange={(e) => setNewRule({ ...newRule, actionDevice: e.target.value })}
                required
              >
                <option value="">Select Device</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">Is set to...</label>
              <input
                type="text"
                className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="e.g., on, off, 75"
                value={newRule.actionValue}
                onChange={(e) => setNewRule({ ...newRule, actionValue: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowRuleModal(false)}
              className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-xl focus:outline-none focus:shadow-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl focus:outline-none focus:shadow-outline"
            >
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 font-sans text-gray-800 p-4 sm:p-8 flex flex-col items-center">
      {/* Feedback Message */}
      {feedback.message && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl text-white z-50 transition-transform duration-300 transform ${feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {feedback.message}
        </div>
      )}

      {/* Main Dashboard */}
      <div className="w-full max-w-7xl flex flex-col md:flex-row gap-6">
        
        {/* Left Panel: Devices & Automation */}
        <div className="flex-1">
          <header className="mb-6">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-2">Smart Home Dashboard</h1>
            <p className="text-gray-600">Your connected devices at a glance.</p>
            {userId && (
              <p className="mt-2 text-sm text-gray-500 break-words">User ID: {userId}</p>
            )}
          </header>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">My Devices</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map(renderDeviceCard)}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Automation Rules</h2>
              <button
                onClick={() => setShowRuleModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold p-2 rounded-full shadow-lg transition-transform duration-300 hover:scale-105"
                title="Create new rule"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20">
              {rules.length === 0 ? (
                <p className="text-gray-500 italic">No rules configured. Click the '+' button to add one.</p>
              ) : (
                <ul className="space-y-4">
                  {rules.map(rule => (
                    <li key={rule.id} className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
                      <p className="text-lg font-semibold text-gray-800 mb-1">{rule.name}</p>
                      <p className="text-sm text-gray-600">
                        If <span className="font-bold">{devices.find(d => d.id === rule.triggerDevice)?.name || 'Device'}</span> is {rule.triggerCondition} <span className="font-bold">{rule.triggerValue}</span>, then set <span className="font-bold">{devices.find(d => d.id === rule.actionDevice)?.name || 'Device'}</span> to <span className="font-bold">{rule.actionValue}</span>.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        {/* Right Panel: Charts */}
        <div className="w-full md:w-2/5 lg:w-1/3 flex-shrink-0">
          <div className="bg-white/50 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-white/20 h-full flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Historical Data</h2>
            <p className="text-sm text-gray-600 mb-6">Living Room Thermostat Temperature Over Time</p>
            <div className="flex-1 min-h-[300px]">
              {historyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatTimestamp}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      tick={{ fill: '#4b5563', fontSize: 12 }}
                      axisLine={{ stroke: '#d1d5db' }}
                    />
                    <YAxis
                      label={{ value: '°F', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#4b5563' } }}
                      tick={{ fill: '#4b5563', fontSize: 12 }}
                      axisLine={{ stroke: '#d1d5db' }}
                    />
                    <Tooltip
                      labelFormatter={formatTimestamp}
                      formatter={(value) => `${value}°F`}
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '10px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 italic">
                  <span className="animate-pulse">Loading historical data...</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {showRuleModal && renderRuleModal()}
    </div>
  );
};

export default App;

