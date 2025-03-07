/**
 * Simple Flow Chart Tool
 * A lightweight tool for creating user flow diagrams
 */

// Main application class
class FlowChartApp {
    constructor() {
        // State variables
        this.nodes = [];
        this.connections = [];
        this.nextNodeId = 1;
        this.nextConnectionId = 1;
        this.selectedElement = null;
        this.isDragging = false;
        this.isConnecting = false;
        this.sourceNode = null;
        this.connectingLine = null;
        this.scale = 1;
        this.mouseX = 0;
        this.mouseY = 0;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.gridSize = 20; // Grid size for snap functionality
        this.lastNodePosition = { x: 100, y: 100 }; // Track last node position to prevent stacking
        
        // DOM elements
        this.canvas = document.getElementById('canvas');
        this.propertiesPanel = document.getElementById('properties-panel');
        this.propertiesContent = document.getElementById('properties-content');
        this.nodeContextMenu = document.getElementById('node-context-menu');
        this.connectionContextMenu = document.getElementById('connection-context-menu');
        this.textEditModal = document.getElementById('text-edit-modal');
        this.textInput = document.getElementById('text-input');
        
        // Setup
        this.setupCanvas();
        this.setupEventListeners();
        this.createSVGDefinitions();
    }
    
    // Initialize canvas with SVG elements
    setupCanvas() {
        // Create SVG container for connections
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.style.position = 'absolute';
        this.svg.style.top = '0';
        this.svg.style.left = '0';
        this.svg.style.pointerEvents = 'none';
        this.canvas.appendChild(this.svg);
    }
    
    // Create SVG definitions (like arrowheads)
    createSVGDefinitions() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Create arrowhead marker
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#333');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.svg.appendChild(defs);
    }
    
    // Setup all event listeners
    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('add-node').addEventListener('click', () => this.addNode());
        document.getElementById('connect-mode').addEventListener('click', () => this.toggleConnectionMode());
        document.getElementById('delete-selected').addEventListener('click', () => this.deleteSelected());
        document.getElementById('clear-all').addEventListener('click', () => this.clearAll());
        document.getElementById('export-png').addEventListener('click', () => this.exportAsPNG());
        document.getElementById('export-json').addEventListener('click', () => this.exportAsJSON());
        document.getElementById('import-json').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.importFromJSON(e));
        
        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());
        
        // Context menu interactions
        document.addEventListener('click', () => this.hideContextMenus());
        this.nodeContextMenu.addEventListener('click', (e) => this.handleNodeContextMenu(e));
        this.connectionContextMenu.addEventListener('click', (e) => this.handleConnectionContextMenu(e));
        
        // Text edit modal
        document.getElementById('save-text').addEventListener('click', () => this.saveTextEdit());
        document.getElementById('cancel-edit').addEventListener('click', () => this.closeTextEditModal());
        
        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        document.addEventListener('mouseup', () => this.handleCanvasMouseUp()); // Capture mouseup outside canvas too
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Add double-click listener for editing node text directly
        this.canvas.addEventListener('dblclick', (e) => {
            const target = e.target.closest('.flow-node');
            if (target) {
                const nodeId = target.dataset.id;
                const nodeData = this.nodes.find(n => n.id === nodeId);
                if (nodeData) {
                    this.openTextEditModal(nodeId, nodeData.text, 'node');
                }
            }
        });
    }
    
    // Add a new node to the canvas
    addNode(x, y, type, text) {
        const nodeType = type || document.getElementById('node-type').value;
        const nodeText = text || 'New Node';
        
        // If x and y are not provided, use the last position plus an offset
        if (x === undefined || y === undefined) {
            // Calculate position based on last node to prevent stacking
            x = this.lastNodePosition.x + 160; // Horizontal spacing
            y = this.lastNodePosition.y;
            
            // If we've moved too far right, start a new row
            const maxX = 2000; // Maximum x position before wrapping
            if (x > maxX) {
                x = 100; // Reset to left side
                y += 120; // Move down for a new row
            }
            
            // Update last position for next node
            this.lastNodePosition = { x, y };
        }
        
        const node = document.createElement('div');
        node.className = `flow-node node-${nodeType}`;
        node.dataset.id = this.nextNodeId++;
        node.dataset.type = nodeType;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        const nodeContent = document.createElement('div');
        nodeContent.className = 'node-content';
        nodeContent.textContent = nodeText;
        node.appendChild(nodeContent);
        
        // Add connectors for different sides of the node
        const positions = ['top', 'right', 'bottom', 'left'];
        positions.forEach(pos => {
            const connector = document.createElement('div');
            connector.className = 'connector';
            connector.dataset.position = pos;
            
            // Position connectors
            switch (pos) {
                case 'top':
                    connector.style.top = '0';
                    connector.style.left = '50%';
                    connector.style.transform = 'translate(-50%, -50%)';
                    break;
                case 'right':
                    connector.style.top = '50%';
                    connector.style.right = '0';
                    connector.style.transform = 'translate(50%, -50%)';
                    break;
                case 'bottom':
                    connector.style.bottom = '0';
                    connector.style.left = '50%';
                    connector.style.transform = 'translate(-50%, 50%)';
                    break;
                case 'left':
                    connector.style.top = '50%';
                    connector.style.left = '0';
                    connector.style.transform = 'translate(-50%, -50%)';
                    break;
            }
            
            // Add connector event listeners
            connector.addEventListener('mousedown', (e) => {
                if (this.isConnecting) {
                    e.stopPropagation();
                    this.createConnection(this.sourceNode, node.dataset.id, e.target.dataset.position);
                }
            });
            
            node.appendChild(connector);
        });
        
        // Store node data
        this.nodes.push({
            id: node.dataset.id,
            type: nodeType,
            text: nodeText,
            x: x,
            y: y
        });
        
        this.canvas.appendChild(node);
        return node;
    }
    
    // Toggle connection mode
    toggleConnectionMode() {
        this.isConnecting = !this.isConnecting;
        const connectButton = document.getElementById('connect-mode');
        
        if (this.isConnecting) {
            connectButton.style.backgroundColor = '#e74c3c';
            this.canvas.classList.add('connecting');
            this.deselectAll();
        } else {
            connectButton.style.backgroundColor = '';
            this.canvas.classList.remove('connecting');
            this.sourceNode = null;
            
            if (this.connectingLine) {
                this.connectingLine.remove();
                this.connectingLine = null;
            }
        }
    }
    
    // Create a connection between two nodes
    createConnection(sourceId, targetId, targetPosition, label) {
        if (sourceId === targetId) return;
        
        // Find source and target nodes
        const sourceNode = this.findNodeElement(sourceId);
        const targetNode = this.findNodeElement(targetId);
        
        if (!sourceNode || !targetNode) return;
        
        // Calculate connection points
        const sourceRect = sourceNode.getBoundingClientRect();
        const targetRect = targetNode.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const sourceX = (sourceRect.left + sourceRect.width / 2 - canvasRect.left) / this.scale;
        const sourceY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / this.scale;
        const targetX = (targetRect.left + targetRect.width / 2 - canvasRect.left) / this.scale;
        const targetY = (targetRect.top + targetRect.height / 2 - canvasRect.top) / this.scale;
        
        // Create the SVG path for the connection
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-line');
        path.dataset.sourceId = sourceId;
        path.dataset.targetId = targetId;
        path.dataset.id = this.nextConnectionId++;
        
        // Calculate control points for a curved path
        const dx = Math.abs(targetX - sourceX);
        const dy = Math.abs(targetY - sourceY);
        const controlOffset = Math.min(100, Math.max(50, Math.min(dx, dy) * 0.5));
        
        const pathData = `M ${sourceX},${sourceY} 
                         C ${sourceX + controlOffset},${sourceY} 
                           ${targetX - controlOffset},${targetY} 
                           ${targetX},${targetY}`;
        
        path.setAttribute('d', pathData);
        this.svg.appendChild(path);
        
        // Add connection label if provided
        const connectionLabel = label || '';
        
        // Store connection data
        this.connections.push({
            id: path.dataset.id,
            sourceId: sourceId,
            targetId: targetId,
            targetPosition: targetPosition,
            label: connectionLabel
        });
        
        // If a label is provided, add it to the path
        if (connectionLabel) {
            this.addConnectionLabel(path.dataset.id, connectionLabel);
        }
        
        // Exit connection mode after creating a connection
        if (this.isConnecting) {
            this.toggleConnectionMode();
        }
        
        return path;
    }
    
    // Add a label to a connection
    addConnectionLabel(connectionId, text) {
        const connection = this.findConnectionElement(connectionId);
        if (!connection) return;
        
        // Create a text element for the label
        const label = document.createElement('div');
        label.className = 'connection-label';
        label.dataset.connectionId = connectionId;
        label.textContent = text;
        
        // Position the label at the middle of the path
        const pathLength = connection.getTotalLength();
        const midPoint = connection.getPointAtLength(pathLength / 2);
        
        label.style.position = 'absolute';
        label.style.left = `${midPoint.x}px`;
        label.style.top = `${midPoint.y}px`;
        label.style.transform = 'translate(-50%, -50%)';
        
        // Add event listener for editing the label
        label.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.openTextEditModal(connectionId, text, 'connection');
        });
        
        this.canvas.appendChild(label);
    }
    
    // Update connection paths when nodes are moved
    updateConnections() {
        this.connections.forEach(conn => {
            const path = this.findConnectionElement(conn.id);
            const sourceNode = this.findNodeElement(conn.sourceId);
            const targetNode = this.findNodeElement(conn.targetId);
            
            if (!path || !sourceNode || !targetNode) return;
            
            const sourceRect = sourceNode.getBoundingClientRect();
            const targetRect = targetNode.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            const sourceX = (sourceRect.left + sourceRect.width / 2 - canvasRect.left) / this.scale;
            const sourceY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / this.scale;
            const targetX = (targetRect.left + targetRect.width / 2 - canvasRect.left) / this.scale;
            const targetY = (targetRect.top + targetRect.height / 2 - canvasRect.top) / this.scale;
            
            // Calculate control points for a curved path
            const dx = Math.abs(targetX - sourceX);
            const dy = Math.abs(targetY - sourceY);
            const controlOffset = Math.min(100, Math.max(50, Math.min(dx, dy) * 0.5));
            
            const pathData = `M ${sourceX},${sourceY} 
                             C ${sourceX + controlOffset},${sourceY} 
                               ${targetX - controlOffset},${targetY} 
                               ${targetX},${targetY}`;
            
            path.setAttribute('d', pathData);
            
            // Update label position
            const label = document.querySelector(`.connection-label[data-connection-id="${conn.id}"]`);
            if (label) {
                const pathLength = path.getTotalLength();
                const midPoint = path.getPointAtLength(pathLength / 2);
                
                label.style.left = `${midPoint.x}px`;
                label.style.top = `${midPoint.y}px`;
            }
        });
    }
    
    // Delete selected element
    deleteSelected() {
        if (!this.selectedElement) return;
        
        if (this.selectedElement.classList && this.selectedElement.classList.contains('flow-node')) {
            this.deleteNode(this.selectedElement.dataset.id);
        } else if (this.selectedElement.classList && this.selectedElement.classList.contains('connection-line')) {
            this.deleteConnection(this.selectedElement.dataset.id);
        }
        
        this.selectedElement = null;
        this.updatePropertiesPanel();
    }
    
    // Delete a node and its connections
    deleteNode(nodeId) {
        // Remove node from DOM
        const nodeElement = this.findNodeElement(nodeId);
        if (nodeElement) nodeElement.remove();
        
        // Remove connections to/from this node
        const connectedPaths = Array.from(this.svg.querySelectorAll(`.connection-line[data-source-id="${nodeId}"], .connection-line[data-target-id="${nodeId}"]`));
        
        connectedPaths.forEach(path => {
            const connectionId = path.dataset.id;
            path.remove();
            
            // Remove connection labels
            const label = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
            if (label) label.remove();
            
            // Remove from connections array
            this.connections = this.connections.filter(conn => conn.id !== connectionId);
        });
        
        // Remove from nodes array
        this.nodes = this.nodes.filter(node => node.id !== nodeId);
    }
    
    // Delete a connection
    deleteConnection(connectionId) {
        // Remove connection path from DOM
        const path = this.findConnectionElement(connectionId);
        if (path) path.remove();
        
        // Remove connection label
        const label = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
        if (label) label.remove();
        
        // Remove from connections array
        this.connections = this.connections.filter(conn => conn.id !== connectionId);
    }
    
    // Clear all nodes and connections
    clearAll() {
        if (confirm('Are you sure you want to clear all elements?')) {
            // Remove all nodes
            this.nodes.forEach(node => {
                const nodeElement = this.findNodeElement(node.id);
                if (nodeElement) nodeElement.remove();
            });
            
            // Remove all connections
            this.connections.forEach(conn => {
                const path = this.findConnectionElement(conn.id);
                if (path) path.remove();
                
                const label = document.querySelector(`.connection-label[data-connection-id="${conn.id}"]`);
                if (label) label.remove();
            });
            
            // Reset arrays and counters
            this.nodes = [];
            this.connections = [];
            this.nextNodeId = 1;
            this.nextConnectionId = 1;
            this.selectedElement = null;
            this.lastNodePosition = { x: 100, y: 100 }; // Reset last node position
            
            this.updatePropertiesPanel();
        }
    }
    
    // Export the diagram as PNG
    exportAsPNG() {
        // First, hide any UI elements that shouldn't be in the export
        this.hideContextMenus();
        
        // Use html2canvas library (must be loaded in the HTML)
        /* 
        Note: This requires html2canvas library to be included in the HTML file:
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
        */
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas library is required for PNG export. Please add it to your HTML.');
            return;
        }
        
        html2canvas(this.canvas).then(canvas => {
            const link = document.createElement('a');
            link.download = 'flow-chart-export.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
    
    // Export the diagram as JSON
    exportAsJSON() {
        // Update nodes positions from the DOM
        this.nodes.forEach(node => {
            const nodeElement = this.findNodeElement(node.id);
            if (nodeElement) {
                node.x = parseInt(nodeElement.style.left);
                node.y = parseInt(nodeElement.style.top);
            }
        });
        
        const data = {
            nodes: this.nodes,
            connections: this.connections,
            nextNodeId: this.nextNodeId,
            nextConnectionId: this.nextConnectionId
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = 'flow-chart-data.json';
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    // Import diagram from JSON
    importFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Clear current diagram
                this.clearAll();
                
                // Import nodes
                data.nodes.forEach(node => {
                    this.addNode(node.x, node.y, node.type, node.text);
                });
                
                // Import connections
                data.connections.forEach(conn => {
                    const path = this.createConnection(conn.sourceId, conn.targetId, conn.targetPosition, conn.label);
                    path.dataset.id = conn.id;
                });
                
                // Update counters
                this.nextNodeId = data.nextNodeId || this.nodes.length + 1;
                this.nextConnectionId = data.nextConnectionId || this.connections.length + 1;
                
                // Update last node position for next additions
                if (this.nodes.length > 0) {
                    const lastNode = this.nodes[this.nodes.length - 1];
                    this.lastNodePosition = { x: lastNode.x, y: lastNode.y };
                }
                
            } catch (error) {
                console.error('Error importing JSON:', error);
                alert('Error importing diagram. Invalid JSON format.');
            }
        };
        
        reader.readAsText(file);
        event.target.value = null; // Reset file input
    }
    
    // Handle mouse down on canvas
    handleCanvasMouseDown(e) {
        const target = e.target.closest('.flow-node') || e.target;
        
        // Right-click for context menu
        if (e.button === 2) {
            if (target.classList.contains('flow-node')) {
                this.showNodeContextMenu(e, target);
            } else if (target.classList.contains('connection-label')) {
                const connectionId = target.dataset.connectionId;
                this.showConnectionContextMenu(e, connectionId);
            }
            return;
        }
        
        // Left-click
        if (e.button === 0) {
            // Handle node selection and dragging
            if (target.classList.contains('flow-node')) {
                // If in connection mode, start a connection
                if (this.isConnecting) {
                    this.sourceNode = target.dataset.id;
                    
                    // Create a temporary line for visual feedback
                    this.connectingLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    this.connectingLine.setAttribute('class', 'connection-line');
                    this.connectingLine.style.strokeDasharray = '5,5';
                    this.svg.appendChild(this.connectingLine);
                } else {
                    // Regular node selection
                    this.deselectAll();
                    target.classList.add('selected');
                    this.selectedElement = target;
                    this.updatePropertiesPanel();
                    
                    // Prepare for dragging
                    this.isDragging = true;
                    const rect = target.getBoundingClientRect();
                    this.dragOffsetX = e.clientX - rect.left;
                    this.dragOffsetY = e.clientY - rect.top;
                }
            } else if (target.classList.contains('connector') && this.isConnecting) {
                // Clicked on a connector in connection mode
                const nodeElement = target.closest('.flow-node');
                this.sourceNode = nodeElement.dataset.id;
                this.sourceConnector = target.dataset.position;
                
                // Create a temporary line for visual feedback
                this.connectingLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                this.connectingLine.setAttribute('class', 'connection-line');
                this.connectingLine.style.strokeDasharray = '5,5';
                this.svg.appendChild(this.connectingLine);
            } else {
                // Clicked on empty canvas
                this.deselectAll();
                this.updatePropertiesPanel();
            }
        }
    }
    
    // Handle mouse move on canvas
    handleCanvasMouseMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        
        // Update connecting line if in connection mode
        if (this.isConnecting && this.connectingLine && this.sourceNode) {
            const sourceNode = this.findNodeElement(this.sourceNode);
            if (!sourceNode) return;
            
            const sourceRect = sourceNode.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            const sourceX = (sourceRect.left + sourceRect.width / 2 - canvasRect.left) / this.scale;
            const sourceY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / this.scale;
            
            const targetX = (e.clientX - canvasRect.left) / this.scale;
            const targetY = (e.clientY - canvasRect.top) / this.scale;
            
            // Calculate control points for a curved path
            const dx = Math.abs(targetX - sourceX);
            const dy = Math.abs(targetY - sourceY);
            const controlOffset = Math.min(100, Math.max(50, Math.min(dx, dy) * 0.5));
            
            const pathData = `M ${sourceX},${sourceY} 
                             C ${sourceX + controlOffset},${sourceY} 
                               ${targetX - controlOffset},${targetY} 
                               ${targetX},${targetY}`;
            
            this.connectingLine.setAttribute('d', pathData);
        }
        
        // Handle node dragging
        if (this.isDragging && this.selectedElement) {
            const canvasRect = this.canvas.getBoundingClientRect();
            
            // Calculate new position with scale
            let x = (e.clientX - canvasRect.left - this.dragOffsetX) / this.scale;
            let y = (e.clientY - canvasRect.top - this.dragOffsetY) / this.scale;
            
            // Snap to grid if needed
            if (this.gridSize > 0) {
                x = Math.round(x / this.gridSize) * this.gridSize;
                y = Math.round(y / this.gridSize) * this.gridSize;
            }
            
            // Apply new position
            this.selectedElement.style.left = `${x}px`;
            this.selectedElement.style.top = `${y}px`;
            
            // Update node data
            const nodeId = this.selectedElement.dataset.id;
            const nodeData = this.nodes.find(n => n.id === nodeId);
            if (nodeData) {
                nodeData.x = x;
                nodeData.y = y;
            }
            
            // Update connections
            this.updateConnections();
            
            // Update properties panel if it's showing this node
            if (this.selectedElement === this.selectedElement) {
                const xInput = document.getElementById('prop-node-x');
                const yInput = document.getElementById('prop-node-y');
                if (xInput && yInput) {
                    xInput.value = x;
                    yInput.value = y;
                }
            }
        }
    }
    
    // Handle mouse up on canvas
    handleCanvasMouseUp() {
        this.isDragging = false;
        
        // Clean up connecting line if needed
        if (this.isConnecting && this.connectingLine) {
            this.connectingLine.remove();
            this.connectingLine = null;
        }
    }
    
    // Show node context menu
    showNodeContextMenu(e, nodeElement) {
        e.preventDefault();
        
        this.selectedElement = nodeElement;
        this.updatePropertiesPanel();
        this.deselectAll();
        nodeElement.classList.add('selected');
        
        const rect = this.canvas.getBoundingClientRect();
        this.nodeContextMenu.style.left = `${e.clientX - rect.left}px`;
        this.nodeContextMenu.style.top = `${e.clientY - rect.top}px`;
        this.nodeContextMenu.style.display = 'block';
    }
    
    // Show connection context menu
    showConnectionContextMenu(e, connectionId) {
        e.preventDefault();
        
        const connection = this.findConnectionElement(connectionId);
        if (!connection) return;
        
        this.selectedElement = connection;
        this.deselectAll();
        
        const rect = this.canvas.getBoundingClientRect();
        this.connectionContextMenu.style.left = `${e.clientX - rect.left}px`;
        this.connectionContextMenu.style.top = `${e.clientY - rect.top}px`;
        this.connectionContextMenu.style.display = 'block';
    }
    
    // Handle node context menu actions
    handleNodeContextMenu(e) {
        const action = e.target.dataset.action;
        const nodeId = this.selectedElement.dataset.id;
        
        if (!action || !nodeId) return;
        
        switch (action) {
            case 'edit':
                const nodeData = this.nodes.find(n => n.id === nodeId);
                if (nodeData) {
                    this.openTextEditModal(nodeId, nodeData.text, 'node');
                }
                break;
                
            case 'delete':
                this.deleteNode(nodeId);
                break;
                
            case 'start-connection':
                this.toggleConnectionMode();
                this.sourceNode = nodeId;
                
                // Create a temporary line for visual feedback
                this.connectingLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                this.connectingLine.setAttribute('class', 'connection-line');
                this.connectingLine.style.strokeDasharray = '5,5';
                this.svg.appendChild(this.connectingLine);
                break;
        }
        
        this.hideContextMenus();
    }
    
    // Handle connection context menu actions
    handleConnectionContextMenu(e) {
        const action = e.target.dataset.action;
        const connectionId = this.selectedElement.dataset.id;
        
        if (!action || !connectionId) return;
        
        switch (action) {
            case 'edit-label':
                const connectionData = this.connections.find(c => c.id === connectionId);
                if (connectionData) {
                    this.openTextEditModal(connectionId, connectionData.label || '', 'connection');
                }
                break;
                
            case 'delete':
                this.deleteConnection(connectionId);
                break;
        }
        
        this.hideContextMenus();
    }
    
    // Hide all context menus
    hideContextMenus() {
        this.nodeContextMenu.style.display = 'none';
        this.connectionContextMenu.style.display = 'none';
    }
    
    // Open text edit modal
    openTextEditModal(id, text, type) {
        this.textEditModal.style.display = 'flex';
        this.textInput.value = text;
        this.textInput.dataset.id = id;
        this.textInput.dataset.type = type;
        document.getElementById('modal-title').textContent = type === 'node' ? 'Edit Node Text' : 'Edit Connection Label';
        this.textInput.focus();
    }
    
    // Save text edit
    saveTextEdit() {
        const id = this.textInput.dataset.id;
        const text = this.textInput.value;
        const type = this.textInput.dataset.type;
        
        if (type === 'node') {
            const nodeData = this.nodes.find(n => n.id === id);
            if (nodeData) {
                nodeData.text = text;
                
                const nodeElement = this.findNodeElement(id);
                if (nodeElement) {
                    const nodeContent = nodeElement.querySelector('.node-content');
                    if (nodeContent) {
                        nodeContent.textContent = text;
                    }
                }
            }
        } else if (type === 'connection') {
            const connectionData = this.connections.find(c => c.id === id);
            if (connectionData) {
                connectionData.label = text;
                
                // Update or create label
                const labelElement = document.querySelector(`.connection-label[data-connection-id="${id}"]`);
                if (labelElement) {
                    labelElement.textContent = text;
                } else {
                    this.addConnectionLabel(id, text);
                }
            }
        }
        
        this.closeTextEditModal();
        this.updatePropertiesPanel();
    }
    
    // Close text edit modal
    closeTextEditModal() {
        this.textEditModal.style.display = 'none';
    }
    
    // Update properties panel with selected element data
    updatePropertiesPanel() {
        this.propertiesContent.innerHTML = '';
        
        if (!this.selectedElement) {
            this.propertiesContent.innerHTML = '<p class="no-selection">Select an element to edit its properties</p>';
            return;
        }
        
        if (this.selectedElement.classList.contains('flow-node')) {
            const nodeId = this.selectedElement.dataset.id;
            const nodeData = this.nodes.find(n => n.id === nodeId);
            
            if (!nodeData) return;
            
            const nodeProps = document.createElement('div');
            nodeProps.innerHTML = `
                <div class="property-group">
                    <label>Node Type</label>
                    <select id="prop-node-type">
                        <option value="process" ${nodeData.type === 'process' ? 'selected' : ''}>Process</option>
                        <option value="decision" ${nodeData.type === 'decision' ? 'selected' : ''}>Decision</option>
                        <option value="start" ${nodeData.type === 'start' ? 'selected' : ''}>Start/End</option>
                        <option value="input" ${nodeData.type === 'input' ? 'selected' : ''}>Input/Output</option>
                    </select>
                </div>
                
                <div class="property-group">
                    <label>Node Text</label>
                    <input type="text" id="prop-node-text" value="${nodeData.text}">
                </div>
                
                <div class="property-group">
                    <label>Position</label>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label>X</label>
                            <input type="number" id="prop-node-x" value="${parseInt(this.selectedElement.style.left)}">
                        </div>
                        <div style="flex: 1;">
                            <label>Y</label>
                            <input type="number" id="prop-node-y" value="${parseInt(this.selectedElement.style.top)}">
                        </div>
                    </div>
                </div>
            `;
            
            this.propertiesContent.appendChild(nodeProps);
            
            // Add event listeners for property changes
            document.getElementById('prop-node-type').addEventListener('change', (e) => {
                const newType = e.target.value;
                nodeData.type = newType;
                
                // Update node class
                this.selectedElement.className = `flow-node node-${newType}`;
                this.selectedElement.dataset.type = newType;
            });
            
            document.getElementById('prop-node-text').addEventListener('change', (e) => {
                const newText = e.target.value;
                nodeData.text = newText;
                
                const nodeContent = this.selectedElement.querySelector('.node-content');
                if (nodeContent) {
                    nodeContent.textContent = newText;
                }
            });
            
            document.getElementById('prop-node-x').addEventListener('change', (e) => {
                const newX = parseInt(e.target.value);
                this.selectedElement.style.left = `${newX}px`;
                this.updateConnections();
            });
            
            document.getElementById('prop-node-y').addEventListener('change', (e) => {
                const newY = parseInt(e.target.value);
                this.selectedElement.style.top = `${newY}px`;
                this.updateConnections();
            });
            
        } else if (this.selectedElement.classList.contains('connection-line')) {
            const connectionId = this.selectedElement.dataset.id;
            const connectionData = this.connections.find(c => c.id === connectionId);
            
            if (!connectionData) return;
            
            const connectionProps = document.createElement('div');
            connectionProps.innerHTML = `
                <div class="property-group">
                    <label>Connection Label</label>
                    <input type="text" id="prop-connection-label" value="${connectionData.label || ''}">
                </div>
                
                <div class="property-group">
                    <label>From Node</label>
                    <input type="text" value="Node ${connectionData.sourceId}" disabled>
                </div>
                
                <div class="property-group">
                    <label>To Node</label>
                    <input type="text" value="Node ${connectionData.targetId}" disabled>
                </div>
            `;
            
            this.propertiesContent.appendChild(connectionProps);
            
            // Add event listener for label change
            document.getElementById('prop-connection-label').addEventListener('change', (e) => {
                const newLabel = e.target.value;
                connectionData.label = newLabel;
                
                // Update or create label
                const labelElement = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
                if (labelElement) {
                    labelElement.textContent = newLabel;
                } else if (newLabel) {
                    this.addConnectionLabel(connectionId, newLabel);
                }
            });
        }
    }
    
    // Deselect all elements
    deselectAll() {
        document.querySelectorAll('.flow-node.selected').forEach(node => {
            node.classList.remove('selected');
        });
    }
    
    // Find node element by ID
    findNodeElement(id) {
        return document.querySelector(`.flow-node[data-id="${id}"]`);
    }
    
    // Find connection element by ID
    findConnectionElement(id) {
        return document.querySelector(`.connection-line[data-id="${id}"]`);
    }
    
    // Zoom controls
    zoomIn() {
        this.scale = Math.min(2, this.scale + 0.1);
        this.applyZoom();
    }
    
    zoomOut() {
        this.scale = Math.max(0.5, this.scale - 0.1);
        this.applyZoom();
    }
    
    resetZoom() {
        this.scale = 1;
        this.applyZoom();
    }
    
    applyZoom() {
        this.canvas.style.transform = `scale(${this.scale})`;
        this.updateConnections();
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for html2canvas for export capability
    if (typeof html2canvas === 'undefined') {
        console.warn('html2canvas library not detected. PNG export will not work.');
        // Dynamically load html2canvas
        const script = document.createElement('script');
        script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
        document.head.appendChild(script);
    }
    
    window.flowChartApp = new FlowChartApp();
});
